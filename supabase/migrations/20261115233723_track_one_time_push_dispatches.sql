
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS push_login_notified_at timestamptz;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS push_dispatched_at timestamptz;

