-- Bound announcement payloads and allow only the types exposed by the UI.
create or replace function public.app_admin_save_announcement(
  p_token uuid,
  p_title text,
  p_content text,
  p_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  v_id bigint;
  v_title text := btrim(coalesce(p_title,''));
  v_content text := btrim(coalesce(p_content,''));
  v_type text := coalesce(nullif(btrim(p_type),''),'general');
begin
  me := public.bm_admin(p_token);

  if length(v_title)<1 or length(v_title)>180 then
    raise exception 'عنوان اعلان باید بین ۱ تا ۱۸۰ نویسه باشد';
  end if;
  if length(v_content)<1 or length(v_content)>5000 then
    raise exception 'متن اعلان باید بین ۱ تا ۵۰۰۰ نویسه باشد';
  end if;
  if v_type not in ('general','meeting') then
    raise exception 'نوع اعلان معتبر نیست';
  end if;

  insert into public.announcements(building_id,title,content,type)
  values(me.building_id,v_title,v_content,v_type)
  returning id into v_id;

  return jsonb_build_object('ok',true,'id',v_id);
end
$function$;
