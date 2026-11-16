-- Enforce poll title, description, option count, option length and uniqueness
-- at the database boundary, not only in the browser.
create or replace function public.app_admin_create_poll(
  p_token uuid,
  p_title text,
  p_description text,
  p_options text[],
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  pid bigint;
  opt text;
  v_order integer := 0;
  v_title text := btrim(coalesce(p_title,''));
  v_description text := nullif(btrim(coalesce(p_description,'')),'');
begin
  me := public.bm_admin(p_token);

  if length(v_title)<1 or length(v_title)>180 then
    raise exception 'عنوان نظرسنجی باید بین ۱ تا ۱۸۰ نویسه باشد';
  end if;

  if v_description is not null and length(v_description)>1000 then
    raise exception 'توضیحات نظرسنجی بیش از حد مجاز است';
  end if;

  if p_options is null or cardinality(p_options) not between 2 and 20 then
    raise exception 'نظرسنجی باید بین ۲ تا ۲۰ گزینه داشته باشد';
  end if;

  if exists(
    select 1 from unnest(p_options) x
     where x is null or length(btrim(x))<1 or length(btrim(x))>120
  ) then
    raise exception 'هر گزینه باید بین ۱ تا ۱۲۰ نویسه باشد';
  end if;

  if (select count(distinct lower(btrim(x))) from unnest(p_options) x)<>cardinality(p_options) then
    raise exception 'گزینه‌های تکراری مجاز نیستند';
  end if;

  insert into public.building_polls(building_id,title,description,is_active,created_by)
  values(me.building_id,v_title,v_description,coalesce(p_is_active,true),me.id)
  returning id into pid;

  foreach opt in array p_options loop
    v_order:=v_order+1;
    insert into public.building_poll_options(poll_id,option_text,sort_order)
    values(pid,btrim(opt),v_order);
  end loop;

  return jsonb_build_object('ok',true,'id',pid);
end
$function$;
