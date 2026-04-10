-- Add acceptance_time column to locomotives table
ALTER TABLE locomotives ADD COLUMN IF NOT EXISTS acceptance_time TIMESTAMPTZ DEFAULT NOW();
