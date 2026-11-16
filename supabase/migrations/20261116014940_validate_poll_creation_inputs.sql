-- Validate poll creation at the database boundary, not only in the browser.
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
  option_index integer := 0;
  option_count integer;
begin
  me := public.bm_admin(p_token);

  if p_title is null or length(btrim(p_title)) = 0 or length(btrim(p_title)) > 180 then
    raise exception 'عنوان نظرسنجی باید بین ۱ تا ۱۸۰ نویسه باشد';
  end if;

  if coalesce(length(p_description), 0) > 1000 then
    raise exception 'توضیحات نظرسنجی بیش از حد مجاز است';
  end if;

  option_count := coalesce(cardinality(p_options), 0);
  if option_count < 2 or option_count > 20 then
    raise exception 'تعداد گزینه‌ها باید بین ۲ تا ۲۰ باشد';
  end if;

  if exists (
    select 1
    from unnest(p_options) as x(value)
    where x.value is null
       or length(btrim(x.value)) = 0
       or length(btrim(x.value)) > 120
  ) then
    raise exception 'هر گزینه باید بین ۱ تا ۱۲۰ نویسه باشد';
  end if;

  if (
    select count(distinct lower(btrim(x.value)))
    from unnest(p_options) as x(value)
  ) <> option_count then
    raise exception 'گزینه‌های تکراری مجاز نیستند';
  end if;

  insert into public.building_polls(
    building_id, title, description, is_active, created_by
  )
  values (
    me.building_id, btrim(p_title), coalesce(btrim(p_description), ''),
    coalesce(p_is_active, true), me.id
  )
  returning id into pid;

  foreach opt in array p_options loop
    option_index := option_index + 1;
    insert into public.building_poll_options(poll_id, option_text, sort_order)
    values (pid, btrim(opt), option_index);
  end loop;

  return jsonb_build_object('ok', true, 'id', pid);
end
$function$;
