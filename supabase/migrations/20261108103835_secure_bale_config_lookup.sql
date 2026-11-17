create or replace function public.app_internal_get_bale_config(p_building_id integer)
returns jsonb language sql security definer set search_path=public,private as $$
  select coalesce(
    (select jsonb_build_object('bot_token',bot_token,'chat_id',chat_id)
     from private.bale_integrations where building_id=p_building_id),
    '{}'::jsonb
  );
$$;
revoke all on function public.app_internal_get_bale_config(integer) from public,anon,authenticated;
grant execute on function public.app_internal_get_bale_config(integer) to service_role;
