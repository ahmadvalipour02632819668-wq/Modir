
CREATE OR REPLACE FUNCTION public.app_claim_bale_dispatch(p_token uuid, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  me public.accounts;
  v_now timestamptz := now();
  v_limit_10m integer;
  v_limit_24h integer;
  v_building_10m integer;
  v_max_10m integer;
  v_max_24h integer;
BEGIN
  me := public.bm_auth(p_token);

  IF p_action NOT IN ('send','discover') THEN
    RETURN false;
  END IF;

  IF p_action='discover' THEN
    v_max_10m := 5;
    v_max_24h := 20;
  ELSE
    v_max_10m := 10;
    v_max_24h := 50;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bale-dispatch:' || me.id::text, 0));

  SELECT count(*) INTO v_limit_10m
  FROM private.push_dispatch_log
  WHERE account_id=me.id AND event='bale_'||p_action
    AND created_at > v_now - interval '10 minutes';

  IF v_limit_10m >= v_max_10m THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_limit_24h
  FROM private.push_dispatch_log
  WHERE account_id=me.id AND event='bale_'||p_action
    AND created_at > v_now - interval '24 hours';

  IF v_limit_24h >= v_max_24h THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bale-building:' || me.building_id::text, 0));

  SELECT count(*) INTO v_building_10m
  FROM private.push_dispatch_log
  WHERE building_id=me.building_id AND event LIKE 'bale_%'
    AND created_at > v_now - interval '10 minutes';

  IF v_building_10m >= 100 THEN
    RETURN false;
  END IF;

  INSERT INTO private.push_dispatch_log(account_id,building_id,event)
  VALUES(me.id,me.building_id,'bale_'||p_action);

  DELETE FROM private.push_dispatch_log
  WHERE created_at < v_now - interval '30 days';

  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION public.app_claim_bale_dispatch(uuid,text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.app_claim_bale_dispatch(uuid,text) TO anon;

