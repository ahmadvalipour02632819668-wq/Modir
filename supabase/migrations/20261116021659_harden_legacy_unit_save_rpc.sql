-- Harden the legacy unit-save RPC: validate values and exemptions, serialize
-- writes, preserve existing exemptions on NULL, and protect confirmed residency.
create or replace function public.app_admin_save_unit(
  p_token uuid,
  p_unit_no integer,
  p_persons integer,
  p_area numeric,
  p_occupancy text,
  p_has_parking boolean,
  p_notes text,
  p_exemptions text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  v_occupancy text;
  v_existing_status text;
  v_issue text;
begin
  me := public.bm_admin(p_token);

  if p_unit_no is null or p_unit_no not between 1 and 9999 then
    raise exception 'شماره واحد معتبر نیست';
  end if;

  if coalesce(p_persons,0) not between 0 and 100 then
    raise exception 'تعداد نفرات واحد معتبر نیست';
  end if;

  if p_area is not null and (p_area < 0 or p_area > 10000) then
    raise exception 'متراژ واحد معتبر نیست';
  end if;

  v_occupancy := coalesce(nullif(btrim(p_occupancy),''),'مالک ساکن');
  if v_occupancy not in ('مالک ساکن','مالک','مستأجر') then
    raise exception 'نوع سکونت معتبر نیست';
  end if;

  if p_notes is not null and length(p_notes)>1000 then
    raise exception 'توضیحات واحد بیش از حد مجاز است';
  end if;

  if p_exemptions is not null and (
    cardinality(p_exemptions)>4
    or array_position(p_exemptions,null) is not null
    or exists(
      select 1 from unnest(p_exemptions) x
       where x not in ('water','gas','repair','parking')
    )
    or cardinality(p_exemptions)<>(
      select count(distinct x) from unnest(p_exemptions) x
    )
  ) then
    raise exception 'فهرست معافیت‌های واحد معتبر نیست';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('building-residency:' || me.building_id::text, 0)
  );

  select u.residency_status
    into v_existing_status
    from public.units u
   where u.building_id=me.building_id
     and u.unit_no=p_unit_no
   for update;

  insert into public.units(
    building_id,unit_no,persons,area,occupancy,has_parking,notes
  )
  values(
    me.building_id,p_unit_no,coalesce(p_persons,0),p_area,v_occupancy,
    coalesce(p_has_parking,false),p_notes
  )
  on conflict(building_id,unit_no) do update set
    persons=excluded.persons,
    area=excluded.area,
    occupancy=excluded.occupancy,
    has_parking=excluded.has_parking,
    notes=excluded.notes,
    updated_at=now();

  if v_existing_status is not null and v_existing_status<>'pending' then
    select i.issue into v_issue
      from public.bm_residency_issues(me.building_id) i
     where i.unit_no=p_unit_no
     limit 1;
    if v_issue is not null then
      raise exception 'تغییر واحد با وضعیت سکونت تأییدشده سازگار نیست: %',v_issue;
    end if;
  end if;

  if p_exemptions is not null then
    delete from public.exemptions
     where building_id=me.building_id and unit_no=p_unit_no;

    insert into public.exemptions(building_id,unit_no,category)
    select me.building_id,p_unit_no,x
      from unnest(p_exemptions) x
    on conflict do nothing;
  end if;
end
$function$;
