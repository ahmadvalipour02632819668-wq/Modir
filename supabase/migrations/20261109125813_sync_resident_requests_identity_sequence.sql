select setval('public.resident_requests_id_seq'::regclass, coalesce((select max(id) from public.resident_requests), 0) + 1, false);
