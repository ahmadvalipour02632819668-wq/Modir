
create or replace function public.app_profile_avatar_set(p_token uuid, p_image_data text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.accounts;
begin
  me := public.bm_auth(p_token);
  if p_image_data is not null and (
    length(p_image_data) > 400000
    or p_image_data !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
  ) then
    raise exception 'تصویر باید JPEG معتبر و حداکثر ۴۰۰ کیلوبایت باشد';
  end if;
  insert into public.profile_avatars(account_id,image_data,updated_at)
  values(me.id,p_image_data,now())
  on conflict(account_id) do update
    set image_data=excluded.image_data,updated_at=now();
  return jsonb_build_object('ok',true);
end
$function$;

