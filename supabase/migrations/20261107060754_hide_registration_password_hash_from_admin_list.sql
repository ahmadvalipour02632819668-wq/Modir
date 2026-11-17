
create or replace function public.app_superadmin_list_requests(p_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
 perform public.bm_superadmin_auth(p_token);
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',r.id,'building_name',r.building_name,'address',r.address,'username',r.username,
   'full_name',r.full_name,'phone',r.phone,'email',r.email,'units_count',r.units_count,
   'manager_is_resident',r.manager_is_resident,'manager_unit_no',r.manager_unit_no,
   'manager_area',r.manager_area,'manager_persons',r.manager_persons,
   'manager_start_date_jalali',r.manager_start_date_jalali,'status',r.status,'created_at',r.created_at
  ) order by r.created_at desc)
  from public.registration_requests r where r.status='pending'
 ),'[]'::jsonb);
end $$;

