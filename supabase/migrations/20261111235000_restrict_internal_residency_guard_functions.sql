-- Keep internal residency validation and trigger functions out of the public RPC surface.
revoke all on function public.bm_residency_issues(integer) from public, anon, authenticated;
revoke all on function public.bm_assert_building_residency_complete(integer) from public, anon, authenticated;
revoke all on function public.bm_guard_residency_financial_write() from public, anon, authenticated;