
revoke all on function public.app_submit_registration(text,text,text,text,text,text,text,integer) from public,authenticated;
revoke all on function public.app_submit_registration(text,text,text,text,text,text,text,integer,boolean,integer,numeric,integer,text) from public,authenticated;
revoke all on function public.app_submit_member_registration(integer,integer,text,text,text,text,text,text,numeric,integer,text) from public,authenticated;
revoke all on function public.app_login_unified(text,text) from public,authenticated;
revoke all on function public.app_admin_list_membership_registrations(uuid) from public,authenticated;
revoke all on function public.app_admin_review_membership_registration(uuid,bigint,text) from public,authenticated;
revoke all on function public.app_superadmin_list_requests(uuid) from public,authenticated;
revoke all on function public.app_superadmin_review_registration(uuid,bigint,text) from public,authenticated;
grant execute on function public.app_submit_registration(text,text,text,text,text,text,text,integer) to anon;
grant execute on function public.app_submit_registration(text,text,text,text,text,text,text,integer,boolean,integer,numeric,integer,text) to anon;
grant execute on function public.app_submit_member_registration(integer,integer,text,text,text,text,text,text,numeric,integer,text) to anon;
grant execute on function public.app_login_unified(text,text) to anon;
grant execute on function public.app_admin_list_membership_registrations(uuid) to anon;
grant execute on function public.app_admin_review_membership_registration(uuid,bigint,text) to anon;
grant execute on function public.app_superadmin_list_requests(uuid) to anon;
grant execute on function public.app_superadmin_review_registration(uuid,bigint,text) to anon;

