
CREATE OR REPLACE FUNCTION public.app_claim_assistant_request(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  me public.accounts;
  v_now timestamptz := now();
  v_account_10m integer;
  v_account_24h integer;
  v_building_10m integer;
BEGIN
  me := public.bm_auth(p_token);

  PERFORM pg_advisory_xact_lock(hashtextextended('assistant-request:' || me.id::text, 0));

  SELECT count(*) INTO v_account_10m
  FROM private.push_dispatch_log
  WHERE account_id=me.id AND event='assistant'
    AND created_at > v_now - interval '10 minutes';

  IF v_account_10m >= 30 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_account_24h
  FROM private.push_dispatch_log
  WHERE account_id=me.id AND event='assistant'
    AND created_at > v_now - interval '24 hours';

  IF v_account_24h >= 150 THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('assistant-building:' || me.building_id::text, 0));

  SELECT count(*) INTO v_building_10m
  FROM private.push_dispatch_log
  WHERE building_id=me.building_id AND event='assistant'
    AND created_at > v_now - interval '10 minutes';

  IF v_building_10m >= 500 THEN
    RETURN false;
  END IF;

  INSERT INTO private.push_dispatch_log(account_id,building_id,event)
  VALUES(me.id,me.building_id,'assistant');

  DELETE FROM private.push_dispatch_log
  WHERE created_at < v_now - interval '30 days';

  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION public.app_claim_assistant_request(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.app_claim_assistant_request(uuid) TO anon;

