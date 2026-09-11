-- Optional SQL script to add updated_at column to requirements table if desired
ALTER TABLE requirements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
