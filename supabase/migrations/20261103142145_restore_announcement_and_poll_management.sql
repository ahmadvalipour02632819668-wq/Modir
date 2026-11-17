
create or replace function public.app_manager_delete_building_announcement(
  p_token uuid, p_building_id uuid, p_announcement_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
  delete from public.building_announcements
   where id=p_announcement_id and building_id=p_building_id;
  if not found then raise exception 'اطلاعیه پیدا نشد'; end if;
  return jsonb_build_object('success',true);
end;
$$;

create or replace function public.app_manager_set_building_poll_active(
  p_token uuid, p_building_id uuid, p_poll_id uuid, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
  update public.building_polls set is_active=coalesce(p_active,false)
   where id=p_poll_id and building_id=p_building_id;
  if not found then raise exception 'نظرسنجی پیدا نشد'; end if;
  return jsonb_build_object('success',true);
end;
$$;

create or replace function public.app_manager_delete_building_poll(
  p_token uuid, p_building_id uuid, p_poll_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
  if not exists(select 1 from public.building_polls where id=p_poll_id and building_id=p_building_id) then
    raise exception 'نظرسنجی پیدا نشد';
  end if;
  delete from public.building_poll_votes where poll_id=p_poll_id;
  delete from public.building_poll_options where poll_id=p_poll_id;
  delete from public.building_polls where id=p_poll_id and building_id=p_building_id;
  return jsonb_build_object('success',true);
end;
$$;

grant execute on function public.app_manager_delete_building_announcement(uuid,uuid,uuid) to anon, authenticated;
grant execute on function public.app_manager_set_building_poll_active(uuid,uuid,uuid,boolean) to anon, authenticated;
grant execute on function public.app_manager_delete_building_poll(uuid,uuid,uuid) to anon, authenticated;

