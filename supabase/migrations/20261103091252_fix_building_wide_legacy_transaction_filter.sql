
do $$
declare vdef text;
begin
  select pg_get_functiondef('public.app_manager_get_transactions(uuid,uuid,integer,integer,text,integer)'::regprocedure) into vdef;

  vdef:=replace(vdef,
    'and (p_unit_no is null or exists(select 1 from public.building_expense_allocations ea',
    'and (p_unit_no is null or (p_unit_no=0 and e.allocation_method=''none'') or (p_unit_no>0 and exists(select 1 from public.building_expense_allocations ea');
  vdef:=replace(vdef,
    'where ea.expense_id=e.id and u.unit_no=p_unit_no))',
    'where ea.expense_id=e.id and u.unit_no=p_unit_no)))');
  vdef:=replace(vdef,
    'and (p_unit_no is null or exists(select 1 from public.building_memberships bm',
    'and (p_unit_no is null or (p_unit_no>0 and exists(select 1 from public.building_memberships bm');
  vdef:=replace(vdef,
    'where bm.id=p.membership_id and u.unit_no=p_unit_no))',
    'where bm.id=p.membership_id and u.unit_no=p_unit_no)))');

  if position('p_unit_no=0 and e.allocation_method' in vdef)=0
    or position('p_unit_no>0 and exists' in vdef)=0 then
    raise exception 'Building-wide transaction filter patch failed';
  end if;
  execute vdef;
end;
$$;

