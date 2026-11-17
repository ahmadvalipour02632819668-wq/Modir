do $migration$
declare v_def text;
begin
 select pg_get_functiondef('public.app_reallocate_member_payments(uuid,uuid)'::regprocedure) into v_def;
 v_def:=replace(v_def,
  'where p.building_id=p_building_id and p.membership_id=p_membership_id);',
  'where p.building_id=p_building_id and p.membership_id=p_membership_id and p.legacy_import_id is null);');
 v_def:=replace(v_def,
  'and p.status=''approved''',
  'and p.status=''approved'' and p.legacy_import_id is null');
 v_def:=replace(v_def,
  'and e.expense_status=''active''',
  'and e.expense_status=''active'' and e.legacy_import_id is null');
 execute v_def;

 select pg_get_functiondef('public.app_recalculate_expense_allocations(uuid,uuid)'::regprocedure) into v_def;
 v_def:=replace(v_def,
  'where p.building_id=p_building_id);',
  'where p.building_id=p_building_id and p.legacy_import_id is null);');
 execute v_def;

 select pg_get_functiondef('public.app_reconcile_inactive_tenant_debts(uuid,uuid)'::regprocedure) into v_def;
 v_def:=replace(v_def,
  'and ea.membership_id=t.id and e.expense_status=''active''',
  'and ea.membership_id=t.id and e.expense_status=''active'' and e.legacy_import_id is null');
 execute v_def;
end;
$migration$;

insert into public.legacy_import_records(building_id,source_table,legacy_id,payload,imported_at)
select '9b79d1a8-91cb-4dc9-8e5c-22aaf5c21002'::uuid,'legacy_balance_snapshot',v.account_id::text,
 jsonb_build_object('account_id',v.account_id,'username',v.username,'unit_no',v.unit_no,'occupancy',v.occupancy,
  'due_charge',v.due_charge,'paid_charge',v.paid_charge,'net_charge',v.net_charge,
  'due_repair',v.due_repair,'paid_repair',v.paid_repair,'net_repair',v.net_repair,
  'due_parking',v.due_parking,'paid_parking',v.paid_parking,'net_parking',v.net_parking,
  'due_water',v.due_water,'paid_water',v.paid_water,'net_water',v.net_water,
  'due_gas',v.due_gas,'paid_gas',v.paid_gas,'net_gas',v.net_gas,'net_total',v.net_total),
 now()
from (values
 ('abcf621b-f322-45bc-843d-eb8aa14e4ba7'::uuid,'negin1',1,'مالک ساکن',3600000,3600000,0,33000000,33000000,0,0,0,0,574000,574000,0,425000,425000,0,0),
 ('5b5951c8-d666-4497-9ac4-d45015991c48'::uuid,'negin2',2,'مالک ساکن',3600000,4011000,-411000,33000000,33000000,0,0,0,0,574000,574000,0,425000,425000,0,-411000),
 ('6fcce0e1-07cf-4de4-b973-55e9fe819101'::uuid,'negin3',3,'مالک',0,0,0,33000000,33000000,0,0,0,0,0,0,0,0,0,0,0),
 ('f9e96105-e5ed-47e4-a0ae-249021a7de4c'::uuid,'negin31',3,'مستأجر',3600000,3600000,0,0,0,0,0,0,0,1145000,1145000,0,846000,846000,0,0),
 ('b7df0d71-98bb-453f-b250-d0b7b21138ee'::uuid,'negin4',4,'مالک ساکن',3600000,3600000,0,33000000,33000000,0,0,0,0,1145000,1145000,0,846000,846000,0,0),
 ('f82dcdc1-edec-4ed9-a0ed-f8736318e29d'::uuid,'negin5',5,'مالک ساکن',3600000,3600000,0,33000000,33000000,0,0,0,0,860000,860000,0,636000,636000,0,0),
 ('395240bc-37f3-4e40-9d9a-cd01e1adc89c'::uuid,'negin6',6,'مالک ساکن',3600000,3600000,0,33000000,33000000,0,0,0,0,574000,574000,0,0,0,0,0),
 ('193fe677-12e3-432b-8a07-7194d5c48970'::uuid,'negin7',7,'مالک',0,0,0,33000000,33000000,0,0,0,0,0,0,0,0,0,0,0),
 ('e3c4eb72-86d0-4e40-9d9a-cd01e1adc89c'::uuid,'negin71',7,'مستأجر',3600000,3600000,0,0,0,0,0,0,0,574000,503000,71000,425000,407000,18000,89000),
 ('2904ee56-2861-43c5-a73c-4b12010682b3'::uuid,'negin8',8,'مالک ساکن',3600000,3600000,0,33000000,33000000,0,5900000,5900000,0,860000,860000,0,636000,636000,0,0),
 ('66204dc3-3ec4-4574-8497-3512fa930a9a'::uuid,'negin9',9,'مالک ساکن',3600000,3300000,300000,33000000,28000000,5000000,0,0,0,1145000,1003000,142000,846000,810000,36000,5478000),
 ('d4587987-f7ae-402d-9ab0-3d3c9b856fbc'::uuid,'negin10',10,'مالک ساکن',3600000,3300000,300000,33000000,28000000,5000000,0,0,0,860000,753000,107000,636000,609000,27000,5434000)
) as v(account_id,username,unit_no,occupancy,due_charge,paid_charge,net_charge,due_repair,paid_repair,net_repair,due_parking,paid_parking,net_parking,due_water,paid_water,net_water,due_gas,paid_gas,net_gas,net_total)
on conflict(building_id,source_table,legacy_id) do update set payload=excluded.payload,imported_at=now();
