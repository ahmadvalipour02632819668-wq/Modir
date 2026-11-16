-- Keep at most one designated primary account per unit when an admin saves an account.
-- Existing account rows are not modified by this migration.
do $migration$
declare
  v_sig regprocedure := 'public.app_admin_save_account(uuid,uuid,integer,text,text,text,text,boolean,boolean,text,integer,text)'::regprocedure;
  v_def text;
  v_old text := E' IF p_id IS NULL THEN\n   INSERT INTO public.accounts';
  v_new text := E' IF coalesce(p_is_primary,false) and coalesce(p_is_active,true) then\n   perform pg_advisory_xact_lock(hashtextextended(''building-residency:''||me.building_id::text,0));\n   update public.accounts set is_primary=false,updated_at=now()\n    where building_id=me.building_id and unit_no=p_unit_no\n      and id is distinct from p_id and is_primary;\n END IF;\n IF p_id IS NULL THEN\n   INSERT INTO public.accounts';
begin
  select pg_get_functiondef(v_sig::oid) into v_def;
  if position('building-residency:''||me.building_id::text' in v_def)>0 then
    return;
  end if;
  if position(v_old in v_def)=0 then
    raise exception 'Expected account-save insertion point not found';
  end if;
  v_def := replace(v_def,v_old,v_new);
  v_def := replace(v_def,'coalesce(p_is_primary,false),coalesce(p_is_active,true),true,v_start_ym',
                           '(coalesce(p_is_primary,false) and coalesce(p_is_active,true)),coalesce(p_is_active,true),true,v_start_ym');
  v_def := replace(v_def,'is_primary=coalesce(p_is_primary,false),is_active=coalesce(p_is_active,true)',
                           'is_primary=(coalesce(p_is_primary,false) and coalesce(p_is_active,true)),is_active=coalesce(p_is_active,true)');
  execute v_def;
end
$migration$;
