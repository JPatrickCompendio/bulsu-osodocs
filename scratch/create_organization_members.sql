-- Create organization_members table for shared account executive member delegation
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  student_number TEXT,
  contact_number TEXT,
  is_president BOOLEAN DEFAULT FALSE,
  security_pin TEXT DEFAULT '1234',
  is_pin_changed BOOLEAN DEFAULT FALSE,
  school_year_id UUID REFERENCES school_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing organization_members table
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS security_pin TEXT DEFAULT '1234';
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS is_pin_changed BOOLEAN DEFAULT FALSE;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS school_year_id UUID REFERENCES school_years(id);

-- Index for fast lookup by organization_id, user_id, and school_year_id
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_sy_id ON organization_members(school_year_id);

-- Enable RLS & grant permissions
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to organization_members" 
  ON organization_members FOR SELECT USING (true);

CREATE POLICY "Allow authenticated full access to organization_members" 
  ON organization_members FOR ALL USING (true);
