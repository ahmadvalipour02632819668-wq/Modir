
create schema if not exists private;
create table if not exists private.bale_integrations (
  building_id integer primary key references public.buildings(id) on delete cascade,
  bot_token text not null,
  chat_id text not null,
  updated_at timestamptz not null default now()
);
revoke all on schema private from public, anon, authenticated;
revoke all on private.bale_integrations from public, anon, authenticated;
grant usage on schema private to service_role;
grant select on private.bale_integrations to service_role;

create or replace function public.app_admin_get_bale_config(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare a public.accounts;
begin
  a := public.bm_admin(p_token);
  return jsonb_build_object(
    'configured', exists(select 1 from private.bale_integrations where building_id=a.building_id),
    'chat_id', (select chat_id from private.bale_integrations where building_id=a.building_id)
  );
end $$;

create or replace function public.app_admin_save_bale_config(p_token uuid,p_bot_token text,p_chat_id text)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare a public.accounts;
begin
  a := public.bm_admin(p_token);
  if nullif(trim(coalesce(p_chat_id,'')),'') is null then
    raise exception 'شناسه گروه یا چت مقصد الزامی است';
  end if;
  if length(trim(p_chat_id)) > 200 then raise exception 'شناسه مقصد نامعتبر است'; end if;
  if nullif(trim(coalesce(p_bot_token,'')),'') is not null then
    if length(trim(p_bot_token)) < 20 or length(trim(p_bot_token)) > 300 then
      raise exception 'توکن ربات نامعتبر است';
    end if;
    insert into private.bale_integrations(building_id,bot_token,chat_id,updated_at)
    values(a.building_id,trim(p_bot_token),trim(p_chat_id),now())
    on conflict(building_id) do update set bot_token=excluded.bot_token,chat_id=excluded.chat_id,updated_at=now();
  else
    update private.bale_integrations set chat_id=trim(p_chat_id),updated_at=now() where building_id=a.building_id;
    if not found then raise exception 'برای ثبت اولیه، توکن ربات را وارد کنید'; end if;
  end if;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.app_bale_authorize(p_token uuid,p_building_id integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare a public.accounts;
begin
  a := public.bm_auth(p_token);
  if a.building_id is distinct from p_building_id then return false; end if;
  return coalesce(a.is_active,false);
exception when others then return false;
end $$;

revoke all on function public.app_admin_get_bale_config(uuid) from public;
revoke all on function public.app_admin_save_bale_config(uuid,text,text) from public;
revoke all on function public.app_bale_authorize(uuid,integer) from public;
grant execute on function public.app_admin_get_bale_config(uuid) to anon,authenticated;
grant execute on function public.app_admin_save_bale_config(uuid,text,text) to anon,authenticated;
grant execute on function public.app_bale_authorize(uuid,integer) to anon,authenticated;

