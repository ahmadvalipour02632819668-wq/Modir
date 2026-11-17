
DO $$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.app_submit_registration(text,text,text,text,text,text,text,integer,boolean,integer,numeric,integer,text)'::regprocedure) INTO v_def;
  v_new := replace(v_def,
    'if p_units_count not between 1 and 10 then',
    'if p_units_count not between 1 and 40 then');
  v_new := replace(v_new,
    'تعداد واحدهای ساختمان باید بین ۱ تا ۱۰ باشد',
    'تعداد واحدهای ساختمان باید بین ۱ تا ۴۰ باشد');
  IF v_new = v_def OR position('not between 1 and 10' in v_new) > 0 THEN
    RAISE EXCEPTION 'Could not safely update app_submit_registration validation';
  END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.app_superadmin_review_registration(uuid,bigint,text)'::regprocedure) INTO v_def;
  v_new := replace(v_def,
    'if r.units_count not between 1 and 10 then',
    'if r.units_count not between 1 and 40 then');
  IF v_new = v_def OR position('not between 1 and 10' in v_new) > 0 THEN
    RAISE EXCEPTION 'Could not safely update app_superadmin_review_registration validation';
  END IF;
  EXECUTE v_new;
END $$;
