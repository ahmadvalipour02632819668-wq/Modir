alter table public.accounts
  drop constraint if exists accounts_role_check;

alter table public.accounts
  add constraint accounts_role_check
  check (role = any (array[
    'resident'::text,
    'manager'::text,
    'superadmin'::text,
    'owner'::text,
    'tenant'::text,
    'resident_owner'::text
  ]));
