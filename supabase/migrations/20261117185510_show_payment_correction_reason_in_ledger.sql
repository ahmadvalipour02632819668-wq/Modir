DO $patch$
DECLARE v text; old_v text;
BEGIN
  SELECT pg_get_functiondef('public.app_admin_correct_approved_payment(uuid,bigint,text)'::regprocedure) INTO v;
  old_v:=v;
  v:=replace(v,
    '''سند اصلاح پرداخت اشتباه شماره ''||tx.id::text',
    '''اصلاح پرداخت اشتباه شماره ''||tx.id::text||'' - ''||left(reason_text,700)');
  IF v=old_v THEN
    IF position('left(reason_text,700)' in v)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'Could not expose correction reason in transaction description';
  END IF;
  EXECUTE v;
END;
$patch$;
