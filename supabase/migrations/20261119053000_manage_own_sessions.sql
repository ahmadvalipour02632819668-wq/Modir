-- Allow each signed-in building account to inspect and revoke only its own other sessions.
create or replace function public.app_list_my_sessions(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_me public.accounts;
  v_sessions jsonb;
begin
  v_me := public.bm_auth(p_token);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'session_id', s.session_id,
        'device_label', s.device_label,
        'created_at', s.created_at,
        'expires_at', s.expires_at,
        'is_current', s.token = p_token
      )
      order by (s.token = p_token) desc, s.created_at desc
    ),
    '[]'::jsonb
  )
  into v_sessions
  from public.sessions s
  where s.account_id = v_me.id
    and s.building_id = v_me.building_id
    and s.revoked_at is null
    and s.expires_at > now();

  return v_sessions;
end;
$function$;

create or replace function public.app_revoke_my_session(
  p_token uuid,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_me public.accounts;
  v_revoked integer := 0;
begin
  v_me := public.bm_auth(p_token);

  update public.sessions s
     set revoked_at = now()
   where s.account_id = v_me.id
     and s.building_id = v_me.building_id
     and s.revoked_at is null
     and s.expires_at > now()
     and s.token <> p_token
     and (p_session_id is null or s.session_id = p_session_id);

  get diagnostics v_revoked = row_count;

  return jsonb_build_object(
    'ok', true,
    'revoked_count', v_revoked
  );
end;
$function$;

revoke all on function public.app_list_my_sessions(uuid) from public;
revoke all on function public.app_revoke_my_session(uuid, uuid) from public;
grant execute on function public.app_list_my_sessions(uuid) to anon, authenticated;
grant execute on function public.app_revoke_my_session(uuid, uuid) to anon, authenticated;
