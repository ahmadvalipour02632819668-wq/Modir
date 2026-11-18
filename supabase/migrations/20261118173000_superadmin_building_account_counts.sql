create or replace function public.app_superadmin_list_buildings(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
begin
 perform public.bm_superadmin_auth(p_token);
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',b.id,'name',b.name,'address',b.address,'status',b.status,
  'created_at',b.created_at,
  'units_count',(select count(*) from public.units u where u.building_id=b.id),
  'accounts_count',(select count(*) from public.accounts a where a.building_id=b.id and a.role <> 'superadmin'),
  'manager',(select jsonb_build_object('id',a.id,'username',a.username,'full_name',a.full_name)
    from public.accounts a where a.id=b.current_manager_account_id and a.building_id=b.id)
 ) order by b.id) from public.buildings b),'[]'::jsonb);
end;
$function$;
revoke all on function public.app_superadmin_list_buildings(uuid) from public,authenticated;
grant execute on function public.app_superadmin_list_buildings(uuid) to anon,service_role;
