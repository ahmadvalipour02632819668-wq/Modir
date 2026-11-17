create table if not exists public.legacy_import_records(
 id bigint generated always as identity primary key,
 building_id uuid not null references public.buildings(id) on delete cascade,
 source_table text not null,
 legacy_id text not null,
 payload jsonb not null,
 imported_at timestamptz not null default now(),
 unique(building_id,source_table,legacy_id)
);
alter table public.legacy_import_records enable row level security;
create index if not exists legacy_import_records_building_source_idx on public.legacy_import_records(building_id,source_table);
create or replace function public.app_resident_get_legacy_history(p_token uuid,p_building_id uuid,p_membership_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_actor public.app_accounts; v_member record; v_manager boolean:=false; v_transactions jsonb:='[]'::jsonb; v_requests jsonb:='[]'::jsonb;
begin
 v_actor:=public.app_require_session(p_token);
 select bm.*,u.unit_no into v_member from public.building_memberships bm join public.units u on u.id=bm.unit_id
 where bm.id=p_membership_id and bm.building_id=p_building_id and bm.membership_status='active';
 if not found then raise exception 'عضویت فعال پیدا نشد'; end if;
 if v_member.account_id<>v_actor.id then perform public.app_financial_v2_require_manager(p_token,p_building_id); v_manager:=true;
 else select exists(select 1 from public.buildings b where b.id=p_building_id and b.current_manager_membership_id=p_membership_id) into v_manager; end if;
 select coalesce(jsonb_agg(payload order by coalesce(payload->>'tx_date',payload->>'created_at') desc,legacy_id desc),'[]'::jsonb)
 into v_transactions from public.legacy_import_records where building_id=p_building_id and source_table='transactions'
 and (v_manager or payload->>'unit_no'=v_member.unit_no::text);
 select coalesce(jsonb_agg(payload order by coalesce(payload->>'created_at',payload->>'pay_date') desc,legacy_id desc),'[]'::jsonb)
 into v_requests from public.legacy_import_records where building_id=p_building_id and source_table='payment_requests'
 and (v_manager or payload->>'unit_no'=v_member.unit_no::text);
 return jsonb_build_object('transactions',v_transactions,'payment_requests',v_requests);
end;$function$;
revoke all on function public.app_resident_get_legacy_history(uuid,uuid,uuid) from public;
grant execute on function public.app_resident_get_legacy_history(uuid,uuid,uuid) to anon,authenticated;
