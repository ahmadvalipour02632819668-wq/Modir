-- Expose archived Negin 2 history only through the token-checked RPC.
revoke all on table public.legacy_import_records from public,anon,authenticated;
create or replace function public.app_resident_get_legacy_history(p_token uuid,p_building_id uuid,p_membership_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
 v_actor public.app_accounts; v_member record; v_manager boolean:=false;
 v_transactions jsonb:='[]'::jsonb; v_requests jsonb:='[]'::jsonb;
 v_announcements jsonb:='[]'::jsonb; v_resident_requests jsonb:='[]'::jsonb;
 v_rates jsonb:='[]'::jsonb; v_exemptions jsonb:='[]'::jsonb;
begin
 v_actor:=public.app_require_session(p_token);
 select bm.*,u.unit_no into v_member from public.building_memberships bm
 join public.units u on u.id=bm.unit_id
 where bm.id=p_membership_id and bm.building_id=p_building_id and bm.membership_status='active';
 if not found then raise exception 'عضویت فعال پیدا نشد'; end if;
 if v_member.account_id<>v_actor.id then
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
  v_manager:=true;
 else
  select exists(select 1 from public.buildings b where b.id=p_building_id and b.current_manager_membership_id=p_membership_id) into v_manager;
 end if;
 select coalesce(jsonb_agg(payload order by coalesce(payload->>'tx_date',payload->>'created_at') desc,legacy_id desc),'[]'::jsonb)
 into v_transactions from public.legacy_import_records
 where building_id=p_building_id and source_table='transactions'
 and (v_manager or payload->>'unit_no'=v_member.unit_no::text);
 select coalesce(jsonb_agg(payload order by coalesce(payload->>'created_at',payload->>'pay_date') desc,legacy_id desc),'[]'::jsonb)
 into v_requests from public.legacy_import_records
 where building_id=p_building_id and source_table='payment_requests'
 and (v_manager or payload->>'unit_no'=v_member.unit_no::text);
 select coalesce(jsonb_agg(payload order by legacy_id),'[]'::jsonb) into v_announcements
 from public.legacy_import_records where building_id=p_building_id and source_table='announcements';
 select coalesce(jsonb_agg(payload order by legacy_id),'[]'::jsonb) into v_resident_requests
 from public.legacy_import_records where building_id=p_building_id and source_table='resident_requests'
 and (v_manager or payload->>'account_id'=v_actor.id::text);
 if v_manager then
  select coalesce(jsonb_agg(payload order by legacy_id),'[]'::jsonb) into v_rates
  from public.legacy_import_records where building_id=p_building_id and source_table='rates';
  select coalesce(jsonb_agg(payload order by legacy_id),'[]'::jsonb) into v_exemptions
  from public.legacy_import_records where building_id=p_building_id and source_table='exemptions';
 end if;
 return jsonb_build_object('transactions',v_transactions,'payment_requests',v_requests,
  'announcements',v_announcements,'resident_requests',v_resident_requests,'rates',v_rates,'exemptions',v_exemptions);
end;$function$;
revoke all on function public.app_resident_get_legacy_history(uuid,uuid,uuid) from public;
grant execute on function public.app_resident_get_legacy_history(uuid,uuid,uuid) to anon,authenticated;
