
create or replace function public.app_manager_create_building_announcement(
  p_token uuid, p_building_id uuid, p_title text, p_content text, p_announcement_type text
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare v_actor public.app_accounts; v_id uuid;
begin
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
  v_actor:=public.app_require_session(p_token);
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_content),'') is null then
    raise exception 'عنوان و متن اطلاعیه الزامی است';
  end if;
  if p_announcement_type not in ('general','meeting') then
    raise exception 'نوع اطلاعیه نامعتبر است';
  end if;
  insert into public.building_announcements(building_id,title,content,announcement_type,created_by)
  values(p_building_id,btrim(p_title),btrim(p_content),p_announcement_type,v_actor.id)
  returning id into v_id;
  return jsonb_build_object('success',true,'id',v_id);
end;
$function$;

create or replace function public.app_resident_submit_group_message(
  p_token uuid, p_building_id uuid, p_membership_id uuid, p_message text
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare v_actor public.app_accounts; v_unit_no integer; v_title text; v_id uuid;
begin
  v_actor:=public.app_require_session(p_token);
  select u.unit_no into v_unit_no
  from public.building_memberships bm
  join public.units u on u.id=bm.unit_id
  where bm.id=p_membership_id and bm.building_id=p_building_id
    and bm.account_id=v_actor.id and bm.membership_status='active'
    and bm.access_role='resident';
  if not found then raise exception 'عضویت فعال ساکن برای این ساختمان پیدا نشد'; end if;
  if nullif(btrim(p_message),'') is null then raise exception 'متن پیام را وارد کنید'; end if;
  if char_length(btrim(p_message))>3000 then raise exception 'حداکثر طول پیام ۳۰۰۰ نویسه است'; end if;
  v_title:='پیام گروهی از واحد '||coalesce(v_unit_no::text,'—');
  insert into public.building_announcements(building_id,title,content,announcement_type,created_by)
  values(p_building_id,v_title,btrim(p_message),'resident_message',v_actor.id)
  returning id into v_id;
  return jsonb_build_object('success',true,'id',v_id,'title',v_title,'content',btrim(p_message));
end;
$function$;

grant execute on function public.app_manager_create_building_announcement(uuid,uuid,text,text,text) to anon, authenticated;
grant execute on function public.app_resident_submit_group_message(uuid,uuid,uuid,text) to anon, authenticated;

