
create or replace function public.bm_on_owner_account_created()
returns trigger language plpgsql security definer set search_path=public as $$
declare s record;
begin
  if new.is_active and new.occupancy in ('مالک','مالک ساکن') then
    for s in
      select x.id from public.account_exit_settlements x
      join public.accounts olda on olda.id=x.account_id
      where x.building_id=new.building_id and x.unit_no=new.unit_no
        and x.status='confirmed' and x.next_occupancy in ('مالک','مالک ساکن')
        and olda.occupancy in ('مالک','مالک ساکن')
        and (x.next_start_date_jalali is null or new.start_date_jalali is null
             or new.start_date_jalali=x.next_start_date_jalali)
      order by x.confirmed_at desc
    loop
      perform public.bm_transfer_owner_exit_balance(s.id,new.id);
      exit;
    end loop;
  end if;
  return new;
end $$;

