-- 1. Insert School Year if not exists
INSERT INTO public.school_years (id, name, start_date, end_date, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'A.Y. 2025-2026', '2025-08-01', '2026-06-30', true)
ON CONFLICT DO NOTHING;

-- 2. Insert Semester if not exists
INSERT INTO public.semesters (id, school_year_id, name, start_date, end_date, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '1st Semester', '2025-08-01', '2025-12-31', true)
ON CONFLICT DO NOTHING;

-- 3. Insert Master Organization
INSERT INTO public.organizations (id, name, abbreviation, org_email)
VALUES ('33333333-3333-3333-3333-333333333333', 'Information Computer Society', 'ICS', 'ics_org@bulsu.edu.ph')
ON CONFLICT DO NOTHING;

-- 4. Insert AY Snapshot
INSERT INTO public.organization_academic_years (
  id, organization_id, school_year_id, status,
  president_name, student_no, contact_no, adviser_name, co_advisers, no_member
)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'active',
  'Maria Santos',
  '2025-00123',
  '09171234567',
  'Dr. Juan Dela Cruz',
  '["Prof. Ana Reyes"]'::jsonb,
  120
)
ON CONFLICT DO NOTHING;
