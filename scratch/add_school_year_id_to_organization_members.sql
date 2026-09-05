-- Migration: Add school_year_id to organization_members table
-- Links executive board members to specific school years to track responsibility per term.

ALTER TABLE organization_members 
ADD COLUMN IF NOT EXISTS school_year_id UUID REFERENCES school_years(id) ON DELETE CASCADE;

-- Create index for faster querying by school year
CREATE INDEX IF NOT EXISTS idx_org_members_school_year_id ON organization_members(school_year_id);

-- Optional: backfill existing members without a school_year_id to the currently active school year
UPDATE organization_members
SET school_year_id = (SELECT id FROM school_years WHERE is_active = true LIMIT 1)
WHERE school_year_id IS NULL;
