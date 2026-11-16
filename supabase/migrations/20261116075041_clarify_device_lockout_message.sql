-- Clarify that an invalid-username cooldown applies to the current device.
CREATE OR REPLACE FUNCTION public.app_login_unified(p_login text, p_password text, p_replace_session_id uuid DEFAULT NULL::uuid, p_device_label text DEFAULT NULL::text, p_device_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'extensions'
AS $function$
declare
  sa public.superadmin_accounts;
  a public.accounts;
  v_token uuid;
  v_count integer;
  v_sessions jsonb;
  b public.buildings;
  v_device text := left(coalesce(nullif(trim(p_device_label),''),'دستگاه ناشناس'),80);
  v_device_id text := nullif(left(trim(coalesce(p_device_id,'')),100), '');
  v_fingerprint text;
  v_failed integer;
  v_locked_until timestamptz;
  v_lock_seconds integer;
  v_device_limit_exists boolean := false;
begin
  if v_device_id is null or length(v_device_id)<8 then
    return jsonb_build_object('ok',false,'code','DEVICE_ID_REQUIRED','error','شناسه این دستگاه دریافت نشد؛ صفحه را تازه‌سازی کنید');
  end if;

  if p_login is null or length(trim(p_login)) > 32
     or p_password is null or length(p_password) > 128 then
    return jsonb_build_object('ok',false,'code','INVALID_CREDENTIALS','error','نام کاربری یا گذرواژه اشتباه است');
  end if;

  -- Unknown usernames are throttled per device, regardless of the text entered.
  -- This avoids locking real accounts when an arbitrary username is guessed.
  v_fingerprint := encode(extensions.digest('login-device:' || v_device_id, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_fingerprint,0));
  select failed_attempts, locked_until into v_failed, v_locked_until
    from private.login_failure_limits where fingerprint=v_fingerprint for update;
  v_device_limit_exists := found;
  if v_device_limit_exists and v_locked_until is not null and v_locked_until>now() then
    v_lock_seconds := greatest(1,ceil(extract(epoch from (v_locked_until-now())))::integer);
    return jsonb_build_object('ok',false,'code','LOGIN_LOCKED',
      'error','ورود این دستگاه به دلیل چند تلاش ناموفق موقتاً مسدود شده است',
      'locked_until',v_locked_until,'lock_seconds',v_lock_seconds,
      'failed_attempts',coalesce(v_failed,0),'attempts_remaining',0);
  end if;

  select * into sa from public.superadmin_accounts
   where lower(username)=lower(trim(coalesce(p_login,''))) and is_active
   limit 1 for update;

  if found and sa.locked_until is not null and sa.locked_until > now() then
    v_lock_seconds := greatest(1,ceil(extract(epoch from (sa.locked_until-now())))::integer);
    return jsonb_build_object(
      'ok',false,'code','LOGIN_LOCKED','error','ورود به دلیل چند تلاش ناموفق موقتاً مسدود شده است',
      'locked_until',sa.locked_until,'lock_seconds',v_lock_seconds,
      'failed_attempts',coalesce(sa.failed_attempts,0),'attempts_remaining',0
    );
  end if;

  if found and sa.password_hash<>extensions.crypt(coalesce(p_password,''),sa.password_hash) then
    update public.superadmin_accounts
       set failed_attempts = coalesce(failed_attempts,0) + 1,
      locked_until = case
        when coalesce(failed_attempts,0) + 1 >= 10 then now() + interval '24 hours'
        when coalesce(failed_attempts,0) + 1 = 9 then now() + interval '60 minutes'
        when coalesce(failed_attempts,0) + 1 = 8 then now() + interval '30 minutes'
        when coalesce(failed_attempts,0) + 1 = 7 then now() + interval '10 minutes'
        when coalesce(failed_attempts,0) + 1 = 6 then now() + interval '1 minute'
        when coalesce(failed_attempts,0) + 1 = 5 then now() + interval '30 seconds'
        else null
      end
     where id = sa.id
     returning failed_attempts, locked_until into v_failed, v_locked_until;

    if v_locked_until is not null and v_locked_until > now() then
      v_lock_seconds := greatest(1,ceil(extract(epoch from (v_locked_until-now())))::integer);
      return jsonb_build_object('ok',false,'code','LOGIN_LOCKED',
        'error','ورود به دلیل چند تلاش ناموفق موقتاً مسدود شده است',
        'locked_until',v_locked_until,'lock_seconds',v_lock_seconds,
        'failed_attempts',v_failed,'attempts_remaining',0);
    end if;
    return jsonb_build_object('ok',false,'code','INVALID_CREDENTIALS',
      'error','نام کاربری یا گذرواژه اشتباه است',
      'failed_attempts',v_failed,'attempts_remaining',greatest(0,5-v_failed));
  end if;

  if found and sa.password_hash=extensions.crypt(coalesce(p_password,''),sa.password_hash) then
    update public.superadmin_accounts set
      password_hash=case when substring(sa.password_hash from 5 for 2)::integer < 12
        then extensions.crypt(p_password,extensions.gen_salt('bf',12)) else sa.password_hash end,
      failed_attempts=0, locked_until=null
     where id=sa.id;
    delete from private.login_failure_limits where fingerprint=v_fingerprint;
    update public.sessions set revoked_at=now()
     where superadmin_id=sa.id and device_id=v_device_id
       and revoked_at is null and expires_at>now();

    select count(distinct coalesce(device_id,'legacy')) into v_count
      from public.sessions
     where superadmin_id=sa.id and revoked_at is null and expires_at>now();

    if v_count>=2 and p_replace_session_id is null then
      select coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,'device_label',device_label,'created_at',created_at) order by created_at),'[]'::jsonb)
       into v_sessions from public.sessions
       where superadmin_id=sa.id and revoked_at is null and expires_at>now();
      return jsonb_build_object('ok',false,'code','SESSION_LIMIT','sessions',v_sessions);
    elsif v_count>=2 then
      update public.sessions set revoked_at=now()
       where session_id=p_replace_session_id and superadmin_id=sa.id and revoked_at is null and expires_at>now();
      if not found then return jsonb_build_object('ok',false,'code','SESSION_CHANGED','error','نشست انتخاب‌شده دیگر فعال نیست؛ دوباره تلاش کنید'); end if;
      select count(distinct coalesce(device_id,'legacy')) into v_count
        from public.sessions where superadmin_id=sa.id and revoked_at is null and expires_at>now();
      if v_count>=2 then
        select coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,'device_label',device_label,'created_at',created_at) order by created_at),'[]'::jsonb)
         into v_sessions from public.sessions where superadmin_id=sa.id and revoked_at is null and expires_at>now();
        return jsonb_build_object('ok',false,'code','SESSION_LIMIT','sessions',v_sessions);
      end if;
    elsif p_replace_session_id is not null then
      return jsonb_build_object('ok',false,'code','SESSION_CHANGED','error','وضعیت نشست‌ها تغییر کرده است؛ دوباره تلاش کنید');
    end if;

    insert into public.sessions(building_id,superadmin_id,expires_at,device_label,device_id)
     values(null,sa.id,now()+interval '8 hours',v_device,v_device_id) returning token into v_token;
    return jsonb_build_object('ok',true,'kind','superadmin','token',v_token,
      'account',jsonb_build_object('id',sa.id,'username',sa.username,'full_name',sa.full_name,'role','superadmin'));
  end if;

  select * into a from public.accounts
   where lower(username)=lower(trim(coalesce(p_login,'')))
   limit 1 for update;

  if not found then
    if not v_device_limit_exists then
      v_failed := 1;
      v_locked_until := null;
      insert into private.login_failure_limits(fingerprint,failed_attempts,locked_until,updated_at)
      values(v_fingerprint,v_failed,null,now());
    else
      v_failed := coalesce(v_failed,0)+1;
      v_locked_until := case
        when v_failed>=10 then now()+interval '24 hours'
        when v_failed=9 then now()+interval '60 minutes'
        when v_failed=8 then now()+interval '30 minutes'
        when v_failed=7 then now()+interval '10 minutes'
        when v_failed=6 then now()+interval '1 minute'
        when v_failed=5 then now()+interval '30 seconds'
        else null end;
      update private.login_failure_limits
        set failed_attempts=v_failed,locked_until=v_locked_until,updated_at=now()
        where fingerprint=v_fingerprint;
    end if;

    if v_locked_until is not null and v_locked_until>now() then
      v_lock_seconds := greatest(1,ceil(extract(epoch from (v_locked_until-now())))::integer);
      return jsonb_build_object('ok',false,'code','LOGIN_LOCKED',
        'error','ورود این دستگاه به دلیل چند تلاش ناموفق موقتاً مسدود شده است',
        'locked_until',v_locked_until,'lock_seconds',v_lock_seconds,
        'failed_attempts',v_failed,'attempts_remaining',0);
    end if;
    return jsonb_build_object('ok',false,'code','INVALID_CREDENTIALS',
      'error','نام کاربری یا گذرواژه اشتباه است',
      'failed_attempts',v_failed,'attempts_remaining',greatest(0,5-v_failed));
  end if;

  if not a.is_active then
    return jsonb_build_object('ok',false,'code','INVALID_CREDENTIALS','error','نام کاربری یا گذرواژه اشتباه است');
  end if;

  if a.locked_until is not null and a.locked_until>now() then
    v_lock_seconds := greatest(1,ceil(extract(epoch from (a.locked_until-now())))::integer);
    return jsonb_build_object('ok',false,'code','LOGIN_LOCKED',
      'error','ورود به دلیل چند تلاش ناموفق موقتاً مسدود شده است',
      'locked_until',a.locked_until,'lock_seconds',v_lock_seconds,
      'failed_attempts',coalesce(a.failed_attempts,0),'attempts_remaining',0);
  end if;

  if a.password_hash<>extensions.crypt(coalesce(p_password,''),a.password_hash) then
    update public.accounts set failed_attempts = coalesce(failed_attempts,0) + 1,
      locked_until = case
        when coalesce(failed_attempts,0) + 1 >= 10 then now() + interval '24 hours'
        when coalesce(failed_attempts,0) + 1 = 9 then now() + interval '60 minutes'
        when coalesce(failed_attempts,0) + 1 = 8 then now() + interval '30 minutes'
        when coalesce(failed_attempts,0) + 1 = 7 then now() + interval '10 minutes'
        when coalesce(failed_attempts,0) + 1 = 6 then now() + interval '1 minute'
        when coalesce(failed_attempts,0) + 1 = 5 then now() + interval '30 seconds'
        else null end
     where id=a.id returning failed_attempts,locked_until into v_failed,v_locked_until;

    if v_locked_until is not null and v_locked_until>now() then
      v_lock_seconds := greatest(1,ceil(extract(epoch from (v_locked_until-now())))::integer);
      return jsonb_build_object('ok',false,'code','LOGIN_LOCKED',
        'error','ورود به دلیل چند تلاش ناموفق موقتاً مسدود شده است',
        'locked_until',v_locked_until,'lock_seconds',v_lock_seconds,
        'failed_attempts',v_failed,'attempts_remaining',0);
    end if;
    return jsonb_build_object('ok',false,'code','INVALID_CREDENTIALS',
      'error','نام کاربری یا گذرواژه اشتباه است',
      'failed_attempts',v_failed,'attempts_remaining',greatest(0,5-v_failed));
  end if;

  update public.accounts set
    password_hash=case when substring(a.password_hash from 5 for 2)::integer < 12
      then extensions.crypt(p_password,extensions.gen_salt('bf',12)) else a.password_hash end,
    failed_attempts=0,locked_until=null where id=a.id;
  delete from private.login_failure_limits where fingerprint=v_fingerprint;

  select * into b from public.buildings where id=a.building_id and status='active';
  if not found then return jsonb_build_object('ok',false,'error','ساختمان حساب کاربری فعال نیست'); end if;

  update public.sessions set revoked_at=now()
   where account_id=a.id and device_id=v_device_id
     and revoked_at is null and expires_at>now();

  select count(distinct coalesce(device_id,'legacy')) into v_count
    from public.sessions where account_id=a.id and revoked_at is null and expires_at>now();

  if v_count>=2 and p_replace_session_id is null then
    select coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,'device_label',device_label,'created_at',created_at) order by created_at),'[]'::jsonb)
     into v_sessions from public.sessions where account_id=a.id and revoked_at is null and expires_at>now();
    return jsonb_build_object('ok',false,'code','SESSION_LIMIT','sessions',v_sessions);
  elsif v_count>=2 then
    update public.sessions set revoked_at=now()
     where session_id=p_replace_session_id and account_id=a.id and revoked_at is null and expires_at>now();
    if not found then return jsonb_build_object('ok',false,'code','SESSION_CHANGED','error','نشست انتخاب‌شده دیگر فعال نیست؛ دوباره تلاش کنید'); end if;
    select count(distinct coalesce(device_id,'legacy')) into v_count
      from public.sessions where account_id=a.id and revoked_at is null and expires_at>now();
    if v_count>=2 then
      select coalesce(jsonb_agg(jsonb_build_object('session_id',session_id,'device_label',device_label,'created_at',created_at) order by created_at),'[]'::jsonb)
       into v_sessions from public.sessions where account_id=a.id and revoked_at is null and expires_at>now();
      return jsonb_build_object('ok',false,'code','SESSION_LIMIT','sessions',v_sessions);
    end if;
  elsif p_replace_session_id is not null then
    return jsonb_build_object('ok',false,'code','SESSION_CHANGED','error','وضعیت نشست‌ها تغییر کرده است؛ دوباره تلاش کنید');
  end if;

  insert into public.sessions(account_id,building_id,expires_at,device_label,device_id)
   values(a.id,a.building_id,now()+interval '7 days',v_device,v_device_id) returning token into v_token;
  insert into public.activity_logs(building_id,account_id,unit_no,full_name,action,details,actor_id)
   values(a.building_id,a.id,a.unit_no,a.full_name,'ورود','ورود موفق',a.id);
  return jsonb_build_object('ok',true,'kind','building','token',v_token,
   'account',public.bm_account_json(a)||jsonb_build_object('building_name',b.name,'units_count',(select count(*) from public.units where building_id=a.building_id)));
end
$function$
;
revoke all on function public.app_login_unified(text,text,uuid,text,text) from public;
grant execute on function public.app_login_unified(text,text,uuid,text,text) to anon, authenticated;
