
CREATE TABLE IF NOT EXISTS private.push_dispatch_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL,
  building_id integer NOT NULL,
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_dispatch_log_account_created_idx
  ON private.push_dispatch_log (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS push_dispatch_log_building_created_idx
  ON private.push_dispatch_log (building_id, created_at DESC);

ALTER TABLE private.push_dispatch_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.push_dispatch_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_claim_push_dispatch(p_token uuid, p_event text)
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

  IF p_event NOT IN (
    'resident_login','resident_request_created','payment_request_created',
    'announcement_created','poll_created','group_message_created',
    'manager_reply_created','payment_reviewed'
  ) THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('push-dispatch:' || me.id::text, 0));

  SELECT count(*) INTO v_account_10m
  FROM private.push_dispatch_log
  WHERE account_id=me.id AND created_at > v_now - interval '10 minutes';

  IF v_account_10m >= 20 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_account_24h
  FROM private.push_dispatch_log
  WHERE account_id=me.id AND created_at > v_now - interval '24 hours';

  IF v_account_24h >= 80 THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('push-building:' || me.building_id::text, 0));

  SELECT count(*) INTO v_building_10m
  FROM private.push_dispatch_log
  WHERE building_id=me.building_id AND created_at > v_now - interval '10 minutes';

  IF v_building_10m >= 250 THEN
    RETURN false;
  END IF;

  INSERT INTO private.push_dispatch_log(account_id,building_id,event)
  VALUES(me.id,me.building_id,p_event);

  DELETE FROM private.push_dispatch_log
  WHERE created_at < v_now - interval '30 days';

  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION public.app_claim_push_dispatch(uuid,text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.app_claim_push_dispatch(uuid,text) TO anon;

