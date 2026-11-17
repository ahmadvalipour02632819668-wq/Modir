
CREATE OR REPLACE FUNCTION public.app_submit_registration(
 p_username text, p_password text, p_full_name text, p_phone text, p_email text,
 p_requested_role text, p_building_id uuid DEFAULT NULL, p_unit_no integer DEFAULT NULL,
 p_area numeric DEFAULT NULL, p_resident_count integer DEFAULT NULL,
 p_new_building_name text DEFAULT NULL, p_new_building_unit_count integer DEFAULT NULL,
 p_new_building_address text DEFAULT NULL, p_new_building_floor_count integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_role text := lower(btrim(coalesce(p_requested_role,'')));
 v_unit_id uuid;
BEGIN
 IF nullif(btrim(coalesce(p_username,'')),'') IS NULL
    OR nullif(p_password,'') IS NULL
    OR nullif(btrim(coalesce(p_full_name,'')),'') IS NULL THEN
   RAISE EXCEPTION 'نام کاربری، رمز عبور و نام و نام خانوادگی الزامی است';
 END IF;

 IF v_role NOT IN ('manager','building_manager','owner','owner_resident','tenant') THEN
   RAISE EXCEPTION 'نوع ثبت‌نام نامعتبر است';
 END IF;

 IF EXISTS (SELECT 1 FROM public.app_accounts a WHERE lower(a.username)=lower(btrim(p_username))) THEN
   RAISE EXCEPTION 'نام کاربری تکراری است';
 END IF;
 IF EXISTS (SELECT 1 FROM public.registration_requests rr
            WHERE lower(rr.username)=lower(btrim(p_username)) AND rr.request_status='pending') THEN
   RAISE EXCEPTION 'برای این نام کاربری درخواست ثبت‌نام در انتظار بررسی وجود دارد';
 END IF;

 IF v_role IN ('manager','building_manager') THEN
   IF nullif(btrim(p_new_building_name),'') IS NULL THEN RAISE EXCEPTION 'نام ساختمان الزامی است'; END IF;
   IF p_new_building_unit_count IS NULL OR p_new_building_unit_count<1 OR p_new_building_unit_count>1000 THEN
     RAISE EXCEPTION 'تعداد واحد نامعتبر است';
   END IF;
   IF nullif(btrim(p_new_building_address),'') IS NULL THEN RAISE EXCEPTION 'آدرس ساختمان الزامی است'; END IF;
   IF p_new_building_floor_count IS NULL OR p_new_building_floor_count<1 OR p_new_building_floor_count>200 THEN
     RAISE EXCEPTION 'تعداد طبقات نامعتبر است';
   END IF;
   IF p_building_id IS NOT NULL OR p_unit_no IS NOT NULL THEN
     RAISE EXCEPTION 'درخواست مدیر ساختمان جدید نباید شناسه ساختمان یا شماره واحد داشته باشد';
   END IF;
 ELSE
   IF p_building_id IS NULL OR p_unit_no IS NULL OR p_unit_no<1 THEN
     RAISE EXCEPTION 'انتخاب ساختمان و شماره واحد الزامی است';
   END IF;
   IF p_area IS NULL OR p_area<=0 THEN RAISE EXCEPTION 'متراژ واحد باید بیشتر از صفر باشد'; END IF;
   IF p_resident_count IS NOT NULL AND p_resident_count<1 THEN
     RAISE EXCEPTION 'تعداد ساکنان باید حداقل یک نفر باشد';
   END IF;

   SELECT u.id INTO v_unit_id
   FROM public.units u
   WHERE u.building_id=p_building_id AND u.unit_no=p_unit_no
   FOR UPDATE;
   IF v_unit_id IS NULL THEN RAISE EXCEPTION 'واحد انتخاب‌شده در این ساختمان وجود ندارد'; END IF;

   -- وضعیت اعضای فعال
   IF v_role IN ('owner','owner_resident') AND EXISTS (
     SELECT 1 FROM public.building_memberships bm
     WHERE bm.unit_id=v_unit_id AND bm.membership_status='active'
       AND bm.resident_type IN ('owner','owner_resident')
   ) THEN RAISE EXCEPTION 'این واحد قبلاً مالک فعال دارد'; END IF;

   IF v_role='tenant' AND EXISTS (
     SELECT 1 FROM public.building_memberships bm
     WHERE bm.unit_id=v_unit_id AND bm.membership_status='active'
       AND bm.resident_type='tenant'
   ) THEN RAISE EXCEPTION 'این واحد قبلاً مستأجر فعال دارد'; END IF;

   IF v_role='tenant' AND EXISTS (
     SELECT 1 FROM public.building_memberships bm
     WHERE bm.unit_id=v_unit_id AND bm.membership_status='active'
       AND bm.resident_type='owner_resident'
   ) THEN RAISE EXCEPTION 'این واحد دارای مالک ساکن فعال است و امکان ثبت مستأجر وجود ندارد'; END IF;

   IF v_role='owner_resident' AND EXISTS (
     SELECT 1 FROM public.building_memberships bm
     WHERE bm.unit_id=v_unit_id AND bm.membership_status='active'
       AND bm.resident_type='tenant'
   ) THEN RAISE EXCEPTION 'این واحد دارای مستأجر فعال است و امکان ثبت مالک ساکن وجود ندارد'; END IF;

   -- درخواست‌های در انتظار نیز مانع درخواست متناقض یا تکراری هستند
   IF EXISTS (
     SELECT 1 FROM public.registration_requests rr
     WHERE rr.building_id=p_building_id AND rr.unit_no=p_unit_no
       AND rr.request_status='pending'
       AND (
         (v_role IN ('owner','owner_resident') AND rr.requested_role IN ('owner','owner_resident'))
         OR (v_role='tenant' AND rr.requested_role IN ('tenant','owner_resident'))
         OR (v_role='owner_resident' AND rr.requested_role='tenant')
       )
   ) THEN RAISE EXCEPTION 'برای این واحد درخواست متعارض یا مشابه در انتظار بررسی وجود دارد'; END IF;
 END IF;

 INSERT INTO public.registration_requests(
   username,requested_password_hash,full_name,phone,email,requested_role,
   building_id,unit_no,area,resident_count,new_building_name,
   new_building_unit_count,new_building_address,new_building_floor_count
 ) VALUES (
   btrim(p_username),extensions.crypt(p_password,extensions.gen_salt('bf')),
   btrim(p_full_name),p_phone,p_email,v_role,p_building_id,p_unit_no,p_area,
   p_resident_count,p_new_building_name,p_new_building_unit_count,
   p_new_building_address,p_new_building_floor_count
 );
 RETURN jsonb_build_object('success',true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_review_resident_request(
 p_token uuid, p_request_id uuid, p_approve boolean,
 p_review_note text DEFAULT NULL, p_join_date date DEFAULT CURRENT_DATE,
 p_opening_debt numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 r public.registration_requests;
 actor uuid;
 v_unit_id uuid;
 v_account_id uuid;
 v_member_id uuid;
BEGIN
 SELECT * INTO r FROM public.registration_requests rr WHERE rr.id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.request_status<>'pending' THEN RAISE EXCEPTION 'درخواست معتبر نیست'; END IF;
 actor:=public.app_financial_v2_require_manager(p_token,r.building_id);

 IF NOT p_approve THEN
   UPDATE public.registration_requests SET request_status='rejected',review_note=p_review_note,
     reviewed_by=actor,reviewed_at=now() WHERE id=r.id;
   RETURN jsonb_build_object('success',true);
 END IF;

 IF r.requested_role NOT IN ('owner','owner_resident','tenant') THEN
   RAISE EXCEPTION 'نوع درخواست ساکن نامعتبر است';
 END IF;
 IF p_join_date IS NULL OR p_join_date>current_date OR p_opening_debt<0 THEN
   RAISE EXCEPTION 'تاریخ شروع یا بدهی اولیه نامعتبر است';
 END IF;
 IF EXISTS (SELECT 1 FROM public.app_accounts a WHERE lower(a.username)=lower(r.username)) THEN
   RAISE EXCEPTION 'نام کاربری قبلاً استفاده شده است';
 END IF;
 SELECT u.id INTO v_unit_id FROM public.units u
 WHERE u.building_id=r.building_id AND u.unit_no=r.unit_no FOR UPDATE;
 IF v_unit_id IS NULL THEN RAISE EXCEPTION 'واحد انتخاب‌شده در ساختار ساختمان وجود ندارد'; END IF;
 IF r.area IS NULL OR r.area<=0 THEN RAISE EXCEPTION 'متراژ واحد نامعتبر است'; END IF;
 IF r.resident_count IS NOT NULL AND r.resident_count<1 THEN RAISE EXCEPTION 'تعداد ساکنان نامعتبر است'; END IF;

 IF EXISTS (
   SELECT 1 FROM public.registration_requests rr
   WHERE rr.id<>r.id AND rr.building_id=r.building_id AND rr.unit_no=r.unit_no
     AND rr.request_status='pending'
     AND (
       (r.requested_role IN ('owner','owner_resident') AND rr.requested_role IN ('owner','owner_resident'))
       OR (r.requested_role='tenant' AND rr.requested_role IN ('tenant','owner_resident'))
       OR (r.requested_role='owner_resident' AND rr.requested_role='tenant')
     )
 ) THEN RAISE EXCEPTION 'درخواست با درخواست دیگری که هنوز تعیین تکلیف نشده تعارض دارد'; END IF;

 IF r.requested_role IN ('owner','owner_resident') AND EXISTS (
   SELECT 1 FROM public.building_memberships bm WHERE bm.unit_id=v_unit_id
   AND bm.membership_status='active' AND bm.resident_type IN ('owner','owner_resident')
 ) THEN RAISE EXCEPTION 'این واحد قبلاً مالک فعال دارد'; END IF;
 IF r.requested_role='tenant' AND EXISTS (
   SELECT 1 FROM public.building_memberships bm WHERE bm.unit_id=v_unit_id
   AND bm.membership_status='active' AND bm.resident_type='tenant'
 ) THEN RAISE EXCEPTION 'این واحد قبلاً مستأجر فعال دارد'; END IF;
 IF r.requested_role='tenant' AND EXISTS (
   SELECT 1 FROM public.building_memberships bm WHERE bm.unit_id=v_unit_id
   AND bm.membership_status='active' AND bm.resident_type='owner_resident'
 ) THEN RAISE EXCEPTION 'واحد دارای مالک ساکن فعال است'; END IF;
 IF r.requested_role='owner_resident' AND EXISTS (
   SELECT 1 FROM public.building_memberships bm WHERE bm.unit_id=v_unit_id
   AND bm.membership_status='active' AND bm.resident_type='tenant'
 ) THEN RAISE EXCEPTION 'واحد دارای مستأجر فعال است'; END IF;

 UPDATE public.units SET area=r.area,resident_count=coalesce(r.resident_count,1) WHERE id=v_unit_id;
 INSERT INTO public.app_accounts(username,password_hash,full_name,phone,email,account_status,must_change_password)
 VALUES(r.username,r.requested_password_hash,r.full_name,r.phone,r.email,'active',true)
 RETURNING id INTO v_account_id;
 INSERT INTO public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at,opening_debt)
 VALUES(r.building_id,v_account_id,v_unit_id,'resident',r.requested_role,'active',p_join_date,p_opening_debt)
 RETURNING id INTO v_member_id;
 UPDATE public.registration_requests SET request_status='approved',reviewed_by=actor,
   reviewed_at=now(),review_note=p_review_note WHERE id=r.id;
 PERFORM public.app_recalculate_expense_allocations(p_token,r.building_id);
 RETURN jsonb_build_object('success',true,'membership_id',v_member_id);
END;
$function$;

