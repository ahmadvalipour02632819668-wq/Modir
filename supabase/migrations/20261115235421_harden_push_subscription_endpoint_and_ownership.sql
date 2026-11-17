
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_host_allowed
  CHECK (
    length(endpoint) <= 2048
    AND endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
  ) NOT VALID;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_p256dh_format
  CHECK (p256dh ~ '^[A-Za-z0-9_-]{80,120}$') NOT VALID;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_auth_format
  CHECK (auth ~ '^[A-Za-z0-9_-]{16,64}$') NOT VALID;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_agent_length
  CHECK (user_agent IS NULL OR length(user_agent) <= 512) NOT VALID;

ALTER TABLE public.push_subscriptions
  VALIDATE CONSTRAINT push_subscriptions_endpoint_host_allowed;
ALTER TABLE public.push_subscriptions
  VALIDATE CONSTRAINT push_subscriptions_p256dh_format;
ALTER TABLE public.push_subscriptions
  VALIDATE CONSTRAINT push_subscriptions_auth_format;
ALTER TABLE public.push_subscriptions
  VALIDATE CONSTRAINT push_subscriptions_user_agent_length;

CREATE OR REPLACE FUNCTION public.app_push_save_subscription(
  p_token uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me public.accounts;
  v_rows integer;
BEGIN
  me := public.bm_auth(p_token);

  IF p_endpoint IS NULL OR length(p_endpoint)>2048
     OR p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' THEN
    RAISE EXCEPTION 'نشانی سرویس اعلان معتبر نیست';
  END IF;

  IF p_p256dh IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{80,120}$'
     OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{16,64}$' THEN
    RAISE EXCEPTION 'کلیدهای اشتراک اعلان معتبر نیستند';
  END IF;

  IF p_user_agent IS NOT NULL AND length(p_user_agent)>512 THEN
    RAISE EXCEPTION 'اطلاعات مرورگر بیش از حد مجاز است';
  END IF;

  INSERT INTO public.push_subscriptions(
    account_id,building_id,endpoint,p256dh,auth,user_agent,updated_at
  )
  VALUES(
    me.id,me.building_id,p_endpoint,p_p256dh,p_auth,p_user_agent,now()
  )
  ON CONFLICT(endpoint) DO UPDATE
    SET p256dh=excluded.p256dh,
        auth=excluded.auth,
        user_agent=excluded.user_agent,
        updated_at=now()
    WHERE public.push_subscriptions.account_id=excluded.account_id
      AND public.push_subscriptions.building_id=excluded.building_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows=0 THEN
    RETURN jsonb_build_object('ok',false,'error','این اشتراک اعلان قبلاً به حساب دیگری متصل شده است');
  END IF;

  RETURN jsonb_build_object('ok',true);
END
$function$;

