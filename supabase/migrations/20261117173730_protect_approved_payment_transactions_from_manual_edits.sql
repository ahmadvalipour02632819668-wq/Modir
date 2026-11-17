-- Prevent generic manual transaction editing from changing approved payment ledger rows.
CREATE OR REPLACE FUNCTION public.app_admin_save_transaction(
  p_token uuid, p_id bigint, p_year integer, p_month integer, p_day integer,
  p_unit_no integer, p_tx_type text, p_category text, p_location text,
  p_description text, p_amount bigint, p_occupancy text DEFAULT NULL::text,
  p_force boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  me public.accounts;
  v_unit int := nullif(p_unit_no,0);
  v_occ text;
  v_loc text;
  v_desc text;
  t public.transactions;
BEGIN
  me := public.bm_admin(p_token);
  IF p_category IS NOT NULL AND p_category <> '' AND p_category !~ '^[a-z0-9_]{1,64}$' THEN RAISE EXCEPTION 'دسته‌بندی معتبر نیست'; END IF;
  IF p_tx_type IS NULL OR p_tx_type NOT IN ('درآمد','هزینه') THEN RAISE EXCEPTION 'نوع تراکنش معتبر نیست'; END IF;
  IF p_year IS NULL OR p_year NOT BETWEEN 1300 AND 1600 OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12 OR p_day IS NULL OR p_day NOT BETWEEN 1 AND 31 THEN RAISE EXCEPTION 'تاریخ تراکنش معتبر نیست'; END IF;
  IF p_occupancy IS NOT NULL AND p_occupancy NOT IN ('مالک','مالک ساکن','مستأجر') THEN RAISE EXCEPTION 'نوع سکونت معتبر نیست'; END IF;
  IF coalesce(p_amount,0)<=0 THEN RAISE EXCEPTION 'مبلغ نامعتبر است'; END IF;
  IF v_unit IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.units WHERE building_id=me.building_id AND unit_no=v_unit) THEN RAISE EXCEPTION 'واحد متعلق به این ساختمان نیست'; END IF;

  IF p_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.transactions x WHERE x.id=p_id AND x.building_id=me.building_id
      AND (x.source='payment' OR x.payment_request_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'تراکنش حاصل از تأیید پرداخت قابل ویرایش در فرم تراکنش‌ها نیست؛ برای اصلاح، درخواست پرداخت را از مسیر مربوط بررسی کنید';
  END IF;

  v_loc:=coalesce(nullif(btrim(p_location),''),public.bm_cat_location(p_category));
  v_desc:=coalesce(nullif(btrim(p_description),''),public.bm_cat_desc(p_category));
  v_occ:=coalesce(nullif(btrim(p_occupancy),''),(SELECT occupancy FROM public.units WHERE building_id=me.building_id AND unit_no=v_unit));
  IF p_tx_type='درآمد' AND v_unit IS NOT NULL
     AND (SELECT count(*) FROM public.accounts a WHERE a.building_id=me.building_id AND a.unit_no=v_unit AND a.occupancy=v_occ AND a.is_active)>1
     AND (SELECT count(*) FROM public.accounts a WHERE a.building_id=me.building_id AND a.unit_no=v_unit AND a.occupancy=v_occ AND a.is_active AND a.is_primary)<>1 THEN
    RAISE EXCEPTION 'برای ثبت درآمد، حساب فعال این نوع سکونت در واحد باید به‌صورت یکتا مشخص شده باشد';
  END IF;

  IF NOT coalesce(p_force,false) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'manual-transaction:'||me.building_id::text||':'||p_year::text||':'||p_month::text||':'||p_day::text||':'||
      coalesce(v_unit::text,'<null>')||':'||coalesce(public.bm_norm(p_tx_type),'<null>')||':'||
      coalesce(public.bm_norm(v_loc),'<null>')||':'||coalesce(public.bm_norm(v_desc),'<null>')||':'||p_amount::text,0));
  END IF;
  IF NOT coalesce(p_force,false) AND EXISTS(
    SELECT 1 FROM public.transactions x WHERE x.building_id=me.building_id AND x.year=p_year AND x.month=p_month
      AND x.day=coalesce(p_day,1) AND x.unit_no IS NOT DISTINCT FROM v_unit AND x.tx_type=public.bm_norm(p_tx_type)
      AND x.location IS NOT DISTINCT FROM public.bm_norm(v_loc) AND x.description IS NOT DISTINCT FROM public.bm_norm(v_desc)
      AND x.amount=p_amount AND (p_id IS NULL OR x.id<>p_id)
  ) THEN RETURN jsonb_build_object('ok',false,'duplicate',true,'error','به علت تکراری بودن، داده‌ای ثبت نشد!'); END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.transactions(building_id,year,month,day,unit_no,tx_type,location,description,amount,occupancy,category,source,created_by,account_id)
    VALUES(me.building_id,p_year,p_month,p_day,v_unit,p_tx_type,v_loc,v_desc,p_amount,v_occ,nullif(p_category,''),'manual',me.id,
      CASE WHEN p_tx_type='درآمد' AND v_unit IS NOT NULL THEN
        (SELECT a.id FROM public.accounts a WHERE a.building_id=me.building_id AND a.unit_no=v_unit AND a.occupancy=v_occ AND a.is_active ORDER BY a.is_primary DESC LIMIT 1)
      ELSE NULL END) RETURNING * INTO t;
  ELSE
    UPDATE public.transactions SET year=p_year,month=p_month,day=p_day,unit_no=v_unit,tx_type=p_tx_type,
      location=v_loc,description=v_desc,amount=p_amount,occupancy=v_occ,category=nullif(p_category,''),
      account_id=CASE WHEN p_tx_type='درآمد' AND v_unit IS NOT NULL THEN
        (SELECT a.id FROM public.accounts a WHERE a.building_id=me.building_id AND a.unit_no=v_unit AND a.occupancy=v_occ AND a.is_active ORDER BY a.is_primary DESC LIMIT 1)
      ELSE NULL END
    WHERE id=p_id AND building_id=me.building_id RETURNING * INTO t;
    IF NOT FOUND THEN RAISE EXCEPTION 'تراکنش پیدا نشد'; END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'transaction',to_jsonb(t),'phone',
    (SELECT a.phone FROM public.accounts a WHERE a.building_id=me.building_id AND a.unit_no=t.unit_no AND a.is_active ORDER BY a.is_primary DESC,(a.occupancy='مالک') LIMIT 1));
END;
$function$;
