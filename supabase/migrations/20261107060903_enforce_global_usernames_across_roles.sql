
create or replace function public.enforce_global_username_unique()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
begin
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
drop trigger if exists accounts_global_username_guard on public.accounts;
create trigger accounts_global_username_guard before insert or update of username on public.accounts
for each row execute function public.enforce_global_username_unique();
drop trigger if exists superadmin_global_username_guard on public.superadmin_accounts;
create trigger superadmin_global_username_guard before insert or update of username on public.superadmin_accounts
for each row execute function public.enforce_global_username_unique();

