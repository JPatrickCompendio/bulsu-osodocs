CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Delete old broken entry if any
DELETE FROM auth.identities WHERE user_id = '55555555-5555-5555-5555-555555555555';
DELETE FROM auth.users WHERE id = '55555555-5555-5555-5555-555555555555';

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous,
  created_at,
  updated_at
)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'ics_org@bulsu.edu.ph',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Maria Santos"}'::jsonb,
  false,
  false,
  now(),
  now()
);

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '55555555-5555-5555-5555-555555555555',
  '55555555-5555-5555-5555-555555555555',
  '{"sub":"55555555-5555-5555-5555-555555555555","email":"ics_org@bulsu.edu.ph","email_verified":true}'::jsonb,
  'email',
  now(),
  now(),
  now()
);

INSERT INTO public.users (
  id,
  full_name,
  role,
  status,
  org_name,
  abbreviation,
  student_no,
  contact_no,
  adviser_name,
  co_advisers,
  no_member,
  organization_id
)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'Maria Santos',
  'org-president',
  'Active',
  'Information Computer Society',
  'ICS',
  '2025-00123',
  '09171234567',
  'Dr. Juan Dela Cruz',
  ARRAY['Prof. Ana Reyes']::text[],
  120,
  '33333333-3333-3333-3333-333333333333'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  org_name = EXCLUDED.org_name,
  abbreviation = EXCLUDED.abbreviation,
  student_no = EXCLUDED.student_no,
  contact_no = EXCLUDED.contact_no,
  adviser_name = EXCLUDED.adviser_name,
  co_advisers = EXCLUDED.co_advisers,
  no_member = EXCLUDED.no_member,
  organization_id = EXCLUDED.organization_id;
