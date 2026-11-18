alter table private.superadmin_audit_logs drop constraint if exists superadmin_audit_logs_action_check;
alter table private.superadmin_audit_logs add constraint superadmin_audit_logs_action_check
check (action in ('building_approved','building_rejected','building_suspended','building_activated','building_deleted','manager_suspended','manager_activated','manager_sessions_revoked'));

create or replace function public.app_superadmin_set_manager_status(p_token uuid,p_building_id integer,p_is_active boolean)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_admin uuid; v_account uuid; v_name text; v_manager_name text; v_revoked integer:=0;
begin
 v_admin:=public.bm_superadmin_auth(p_token);
 select b.current_manager_account_id,b.name,a.full_name into v_account,v_name,v_manager_name
 from public.buildings b left join public.accounts a on a.id=b.current_manager_account_id and a.building_id=b.id
 where b.id=p_building_id for update of b;
 if not found or v_account is null then raise exception 'MANAGER_NOT_FOUND'; end if;
 update public.accounts set is_active=p_is_active,updated_at=now() where id=v_account and building_id=p_building_id;
 if not p_is_active then
   update public.sessions set revoked_at=now() where account_id=v_account and revoked_at is null;
   get diagnostics v_revoked=row_count;
 end if;
 insert into private.superadmin_audit_logs(superadmin_id,action,building_id,building_name,details)
 values(v_admin,case when p_is_active then 'manager_activated' else 'manager_suspended' end,p_building_id,v_name,
        case when p_is_active then 'فعال‌سازی حساب مدیر: ' else 'تعلیق حساب مدیر: ' end||coalesce(v_manager_name,'')||case when v_revoked>0 then '؛ نشست‌های لغوشده: '||v_revoked::text else '' end);
 return jsonb_build_object('ok',true,'is_active',p_is_active,'revoked_sessions',v_revoked);
end;
$$;

create or replace function public.app_superadmin_revoke_manager_sessions(p_token uuid,p_building_id integer)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_admin uuid; v_account uuid; v_name text; v_manager_name text; v_revoked integer:=0;
begin
 v_admin:=public.bm_superadmin_auth(p_token);
 select b.current_manager_account_id,b.name,a.full_name into v_account,v_name,v_manager_name
 from public.buildings b left join public.accounts a on a.id=b.current_manager_account_id and a.building_id=b.id
 where b.id=p_building_id for update of b;
 if not found or v_account is null then raise exception 'MANAGER_NOT_FOUND'; end if;
 update public.sessions set revoked_at=now() where account_id=v_account and revoked_at is null;
 get diagnostics v_revoked=row_count;
 insert into private.superadmin_audit_logs(superadmin_id,action,building_id,building_name,details)
 values(v_admin,'manager_sessions_revoked',p_building_id,v_name,'قطع نشست‌های مدیر: '||coalesce(v_manager_name,'')||'؛ نشست‌های لغوشده: '||v_revoked::text);
 return jsonb_build_object('ok',true,'revoked_sessions',v_revoked);
end;
$$;

revoke all on function public.app_superadmin_set_manager_status(uuid,integer,boolean) from public,authenticated;
revoke all on function public.app_superadmin_revoke_manager_sessions(uuid,integer) from public,authenticated;
grant execute on function public.app_superadmin_set_manager_status(uuid,integer,boolean) to anon,service_role;
grant execute on function public.app_superadmin_revoke_manager_sessions(uuid,integer) to anon,service_role;
