
create or replace function public.app_resident_create_building_message(
  p_token uuid, p_building_id uuid, p_membership_id uuid, p_message text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor public.app_accounts;
  v_unit_no integer;
  v_id uuid;
begin
  v_actor := public.app_require_session(p_token);
  select bm.unit_no into v_unit_no
    from public.building_memberships bm
   where bm.id=p_membership_id
     and bm.building_id=p_building_id
     and bm.account_id=v_actor.id
     and bm.membership_status='active';
  if not found then raise exception 'عضویت فعال برای ارسال پیام پیدا نشد'; end if;
  if nullif(btrim(p_message),'') is null then raise exception 'متن پیام را وارد کنید'; end if;
  insert into public.building_announcements(building_id,title,content,announcement_type,created_by)
  values(p_building_id,'پیام گروهی واحد '||coalesce(v_unit_no::text,'—'),btrim(p_message),'resident_message',v_actor.id)
  returning id into v_id;
  return jsonb_build_object('success',true,'id',v_id);
end;
$$;
grant execute on function public.app_resident_create_building_message(uuid,uuid,uuid,text) to anon, authenticated;

