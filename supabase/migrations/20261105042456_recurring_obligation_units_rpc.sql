create or replace function public.app_manager_list_recurring_units(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'unit_no',u.unit_no,'area',u.area,'resident_count',u.resident_count) order by u.unit_no),'[]'::jsonb)
 into v from public.units u where u.building_id=p_building_id;
 return jsonb_build_object('units',v);
end $$;
grant execute on function public.app_manager_list_recurring_units(uuid,uuid) to anon,authenticated;
