
create index if not exists registration_requests_contact_created_idx
  on public.registration_requests (lower(phone), created_at desc);
create index if not exists registration_requests_email_created_idx
  on public.registration_requests (lower(email), created_at desc);
create index if not exists membership_registration_contact_created_idx
  on public.membership_registration_requests (lower(phone), created_at desc);
create index if not exists membership_registration_email_created_idx
  on public.membership_registration_requests (lower(email), created_at desc);

create or replace function public.bm_guard_registration_rate()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  v_phone text := nullif(regexp_replace(coalesce(new.phone,''), '\s+', '', 'g'), '');
  v_email text := nullif(lower(btrim(coalesce(new.email,''))), '');
  v_count integer;
begin
  if v_phone is not null then
    perform pg_advisory_xact_lock(hashtextextended('reg-phone:'||v_phone,0));
  end if;
  if v_email is not null then
    perform pg_advisory_xact_lock(hashtextextended('reg-email:'||v_email,0));
  end if;

  select count(*) into v_count
  from (
    select created_at, phone, email from public.registration_requests
    union all
    select created_at, phone, email from public.membership_registration_requests
  ) r
  where r.created_at >= now() - interval '1 hour'
    and ((v_phone is not null and regexp_replace(coalesce(r.phone,''), '\s+', '', 'g')=v_phone)
      or (v_email is not null and lower(btrim(coalesce(r.email,'')))=v_email));

  if v_count >= 3 then
    raise exception 'برای این شماره موبایل یا ایمیل، تعداد درخواست‌ها در یک ساعت اخیر به حد مجاز رسیده است. کمی بعد دوباره تلاش کنید.'
      using errcode='P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_registration_rate_limit on public.registration_requests;
create trigger trg_registration_rate_limit
before insert on public.registration_requests
for each row execute function public.bm_guard_registration_rate();

drop trigger if exists trg_membership_registration_rate_limit on public.membership_registration_requests;
create trigger trg_membership_registration_rate_limit
before insert on public.membership_registration_requests
for each row execute function public.bm_guard_registration_rate();

revoke all on function public.bm_guard_registration_rate() from public, anon, authenticated;

