create or replace function public.bm_guard_residency_rate_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.bm_assert_building_residency_complete(old.building_id);
    return old;
  else
    perform public.bm_assert_building_residency_complete(new.building_id);
    return new;
  end if;
end;
$$;

drop trigger if exists trg_guard_residency_rates on public.rates;
create trigger trg_guard_residency_rates
before insert or update or delete on public.rates
for each row execute function public.bm_guard_residency_rate_write();

revoke all on function public.bm_guard_residency_rate_write() from public,anon,authenticated;
