-- Serialize residency, membership and financial writes per building.
-- The same transaction-scoped advisory lock is acquired by all participating triggers.
create or replace function public.bm_enforce_unit_membership_rules()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  if tg_op='UPDATE' and old.building_id is distinct from new.building_id then
    perform pg_advisory_xact_lock(hashtextextended('building-residency:'||least(old.building_id,new.building_id)::text,0));
    perform pg_advisory_xact_lock(hashtextextended('building-residency:'||greatest(old.building_id,new.building_id)::text,0));
  else
    perform pg_advisory_xact_lock(hashtextextended('building-residency:'||new.building_id::text,0));
  end if;

  if coalesce(new.is_active,true)=false then
    return new;
  end if;

  if (new.occupancy='مالک ساکن' and exists(
      select 1 from public.accounts a
       where a.building_id=new.building_id and a.unit_no=new.unit_no
         and a.is_active and a.id is distinct from new.id))
    or (new.occupancy='مالک' and exists(
      select 1 from public.accounts a
       where a.building_id=new.building_id and a.unit_no=new.unit_no
         and a.is_active and a.id is distinct from new.id
         and a.occupancy in ('مالک','مالک ساکن')))
    or (new.occupancy='مستأجر' and exists(
      select 1 from public.accounts a
       where a.building_id=new.building_id and a.unit_no=new.unit_no
         and a.is_active and a.id is distinct from new.id
         and a.occupancy in ('مستأجر','مالک ساکن'))) then
    raise exception 'با توجه به ترکیب مالک و مستأجر موجود در این واحد، این عضویت مجاز نیست';
  end if;
  return new;
end
$function$;

create or replace function public.bm_guard_residency_financial_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('building-residency:'||new.building_id::text,0));
  perform public.bm_assert_building_residency_complete(new.building_id);
  return new;
end
$function$;

create or replace function public.bm_guard_residency_rate_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare v_building_id integer;
begin
  if tg_op='DELETE' then
    v_building_id:=old.building_id;
  else
    v_building_id:=new.building_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('building-residency:'||v_building_id::text,0));
  perform public.bm_assert_building_residency_complete(v_building_id);
  if tg_op='DELETE' then return old; end if;
  return new;
end
$function$;

create or replace function public.bm_lock_unit_residency_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  if tg_op='UPDATE' and old.building_id is distinct from new.building_id then
    perform pg_advisory_xact_lock(hashtextextended('building-residency:'||least(old.building_id,new.building_id)::text,0));
    perform pg_advisory_xact_lock(hashtextextended('building-residency:'||greatest(old.building_id,new.building_id)::text,0));
  else
    perform pg_advisory_xact_lock(hashtextextended('building-residency:'||new.building_id::text,0));
  end if;
  return new;
end
$function$;

drop trigger if exists trg_lock_unit_residency_write on public.units;
create trigger trg_lock_unit_residency_write
before insert or update of building_id,unit_no,occupancy,residency_status,residency_confirmed_at,residency_confirmed_by
on public.units
for each row execute function public.bm_lock_unit_residency_write();

revoke all on function public.bm_lock_unit_residency_write() from public,anon,authenticated;
revoke all on function public.bm_enforce_unit_membership_rules() from public,anon,authenticated;
revoke all on function public.bm_guard_residency_financial_write() from public,anon,authenticated;
revoke all on function public.bm_guard_residency_rate_write() from public,anon,authenticated;
