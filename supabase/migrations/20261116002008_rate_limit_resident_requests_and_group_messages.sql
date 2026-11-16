create index if not exists resident_requests_account_created_idx
  on public.resident_requests (account_id, created_at desc);
create index if not exists group_messages_account_created_idx
  on public.group_messages (account_id, created_at desc);

alter table public.resident_requests
  drop constraint if exists resident_requests_type_valid;
alter table public.resident_requests
  add constraint resident_requests_type_valid
  check (type in ('درخواست تعمیرات','انتقاد و پیشنهاد'));
alter table public.resident_requests
  drop constraint if exists resident_requests_description_length;
alter table public.resident_requests
  add constraint resident_requests_description_length
  check (length(btrim(description)) between 1 and 2000);

alter table public.group_messages
  drop constraint if exists group_messages_message_length;
alter table public.group_messages
  add constraint group_messages_message_length
  check (length(btrim(message)) between 1 and 4000);

create or replace function public.app_submit_request(
  p_token uuid,
  p_type text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  rid bigint;
  clean_description text := btrim(coalesce(p_description,''));
begin
  me := public.bm_auth(p_token);
  if p_type not in ('درخواست تعمیرات','انتقاد و پیشنهاد') then
    raise exception 'موضوع درخواست معتبر نیست';
  end if;
  if length(clean_description) not between 1 and 2000 then
    raise exception 'توضیحات درخواست باید بین ۱ تا ۲۰۰۰ نویسه باشد';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('resident-request:' || me.id::text, 0));
  if (select count(*) from public.resident_requests where account_id=me.id and created_at > now()-interval '10 minutes') >= 5
     or
     (select count(*) from public.resident_requests where account_id=me.id and created_at > now()-interval '24 hours') >= 20 then
    raise exception 'تعداد درخواست‌های ثبت‌شده در مدت کوتاه بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید';
  end if;
  insert into public.resident_requests(building_id,account_id,unit_no,type,description,status)
  values(me.building_id,me.id,me.unit_no,p_type,clean_description,'pending')
  returning id into rid;
  return jsonb_build_object('ok',true,'id',rid);
end
$function$;

create or replace function public.app_submit_group_message(
  p_token uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  rid bigint;
  clean_message text := btrim(coalesce(p_message,''));
begin
  me := public.bm_auth(p_token);
  if length(clean_message) not between 1 and 3000 then
    raise exception 'متن پیام باید بین ۱ تا ۳۰۰۰ نویسه باشد';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('group-message:' || me.id::text, 0));
  if (select count(*) from public.group_messages where account_id=me.id and created_at > now()-interval '10 minutes') >= 5
     or
     (select count(*) from public.group_messages where account_id=me.id and created_at > now()-interval '24 hours') >= 30 then
    raise exception 'تعداد پیام‌های گروهی در مدت کوتاه بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید';
  end if;
  insert into public.group_messages(building_id,account_id,message)
  values(me.building_id,me.id,clean_message)
  returning id into rid;
  return jsonb_build_object('ok',true,'id',rid);
end
$function$;
