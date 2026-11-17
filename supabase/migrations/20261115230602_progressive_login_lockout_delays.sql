do $$
declare
  v_def text;
  v_pattern text := $re$failed_attempts\s*=\s*case when failed_attempts\s*\+\s*1\s*>=\s*5 then 0 else failed_attempts\s*\+\s*1 end,\s*locked_until\s*=\s*case when failed_attempts\s*\+\s*1\s*>=\s*5 then now\(\)\s*\+\s*interval '10 minutes' else null end$re$;
  v_replacement text := $rep$failed_attempts = coalesce(failed_attempts,0) + 1,
      locked_until = case
        when coalesce(failed_attempts,0) + 1 >= 10 then now() + interval '24 hours'
        when coalesce(failed_attempts,0) + 1 = 9 then now() + interval '60 minutes'
        when coalesce(failed_attempts,0) + 1 = 8 then now() + interval '30 minutes'
        when coalesce(failed_attempts,0) + 1 = 7 then now() + interval '10 minutes'
        when coalesce(failed_attempts,0) + 1 = 6 then now() + interval '1 minute'
        when coalesce(failed_attempts,0) + 1 = 5 then now() + interval '30 seconds'
        else null
      end$rep$;
  v_count integer;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='app_login_unified'
    and pg_get_function_identity_arguments(p.oid) =
      'p_login text, p_password text, p_replace_session_id uuid, p_device_label text, p_device_id text';

  if v_def is null then
    raise exception 'Current 5-argument app_login_unified function not found';
  end if;

  select count(*) into v_count from regexp_matches(v_def, v_pattern, 'g');
  if v_count <> 2 then
    raise exception 'Expected exactly 2 existing lockout rules, found %; migration cancelled', v_count;
  end if;

  v_def := regexp_replace(v_def, v_pattern, v_replacement, 'g');
  execute v_def;
end $$;
