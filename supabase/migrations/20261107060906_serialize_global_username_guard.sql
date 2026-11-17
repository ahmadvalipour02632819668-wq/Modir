
create or replace function public.enforce_global_username_unique()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(lower(new.username),0));
 if tg_table_name='accounts' then
  if exists(select 1 from public.superadmin_accounts s where lower(s.username)=lower(new.username)) then
   raise exception 'این نام کاربری قبلاً در سامانه استفاده شده است';
  end if;
 elsif tg_table_name='superadmin_accounts' then
  if exists(select 1 from public.accounts a where lower(a.username)=lower(new.username)) then
   raise exception 'این نام کاربری قبلاً در سامانه استفاده شده است';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.enforce_global_username_unique() from public,anon,authenticated;

