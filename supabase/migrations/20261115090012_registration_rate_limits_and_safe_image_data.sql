
create table if not exists public.registration_attempt_log (
  id bigint generated always as identity primary key,
  phone_key text,
  email_key text,
  attempt_kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists registration_attempt_phone_time_idx
  on public.registration_attempt_log(phone_key, created_at desc) where phone_key is not null;
create index if not exists registration_attempt_email_time_idx
  on public.registration_attempt_log(email_key, created_at desc) where email_key is not null;
revoke all on public.registration_attempt_log from anon, authenticated;

create or replace function public.enforce_registration_contact_rate_limit()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public'
as $function$
declare
  v_phone text := regexp_replace(coalesce(new.phone,''), '[^0-9]', '', 'g');
  v_email text := lower(trim(coalesce(new.email,'')));
  v_phone_key text;
  v_email_key text;
  v_count integer;
begin
  if v_phone <> '' then
    v_phone_key := md5(v_phone);
    perform pg_advisory_xact_lock(hashtextextended('registration-phone:' || v_phone_key, 0));
    select count(*) into v_count from public.registration_attempt_log
      where phone_key = v_phone_key and created_at > now() - interval '15 minutes';
    if v_count >= 4 then
      raise exception 'برای این شماره همراه درخواست‌های زیادی ثبت شده است؛ ۱۵ دقیقه دیگر دوباره تلاش کنید';
    end if;
    select count(*) into v_count from public.registration_attempt_log
      where phone_key = v_phone_key and created_at > now() - interval '24 hours';
    if v_count >= 12 then
      raise exception 'سقف درخواست ثبت‌نام این شماره همراه برای امروز تکمیل شده است';
    end if;
  end if;

  if v_email <> '' then
    v_email_key := md5(v_email);
    perform pg_advisory_xact_lock(hashtextextended('registration-email:' || v_email_key, 0));
    select count(*) into v_count from public.registration_attempt_log
      where email_key = v_email_key and created_at > now() - interval '15 minutes';
    if v_count >= 4 then
      raise exception 'برای این ایمیل درخواست‌های زیادی ثبت شده است؛ ۱۵ دقیقه دیگر دوباره تلاش کنید';
    end if;
    select count(*) into v_count from public.registration_attempt_log
      where email_key = v_email_key and created_at > now() - interval '24 hours';
    if v_count >= 12 then
      raise exception 'سقف درخواست ثبت‌نام این ایمیل برای امروز تکمیل شده است';
    end if;
  end if;

  insert into public.registration_attempt_log(phone_key,email_key,attempt_kind)
  values(nullif(v_phone_key,''),nullif(v_email_key,''),tg_table_name);

  delete from public.registration_attempt_log where created_at < now() - interval '30 days';
  return new;
end
$function$;

drop trigger if exists trg_registration_requests_rate_limit on public.registration_requests;
create trigger trg_registration_requests_rate_limit
before insert on public.registration_requests
for each row execute function public.enforce_registration_contact_rate_limit();

drop trigger if exists trg_membership_registration_requests_rate_limit on public.membership_registration_requests;
create trigger trg_membership_registration_requests_rate_limit
before insert on public.membership_registration_requests
for each row execute function public.enforce_registration_contact_rate_limit();

alter table public.payment_requests
  drop constraint if exists payment_requests_receipt_image_safe;
alter table public.payment_requests
  add constraint payment_requests_receipt_image_safe
  check (
    receipt_image is null or
    (length(receipt_image) <= 400000 and
     receipt_image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')
  );

alter table public.profile_avatars
  drop constraint if exists profile_avatars_image_data_safe;
alter table public.profile_avatars
  add constraint profile_avatars_image_data_safe
  check (
    image_data is null or
    (length(image_data) <= 400000 and
     image_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')
  );

