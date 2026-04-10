-- migration_repair_sessions.sql

-- 1. Create repair_sessions table
CREATE TABLE IF NOT EXISTS public.repair_sessions (
    id SERIAL PRIMARY KEY,
    locomotive_id INTEGER REFERENCES public.locomotives(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active', -- 'active' or 'completed'
    created_by INTEGER REFERENCES public.users(id),
    notes TEXT
);

-- Add indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_repair_sessions_active ON public.repair_sessions(locomotive_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_repair_sessions_locomotive_id ON public.repair_sessions(locomotive_id);

-- 2. Add session_id to existing tables
ALTER TABLE public.locomotive_remarks ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES public.repair_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.checklist_instances ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES public.repair_sessions(id) ON DELETE CASCADE;

-- 3. Data Migration: Create an active session for all existing locomotives
INSERT INTO public.repair_sessions (locomotive_id, start_date, status)
SELECT id, COALESCE(acceptance_time, created_at), 'active' FROM public.locomotives;

-- 4. Data Migration: Link existing active remarks to the active session for that locomotive
UPDATE public.locomotive_remarks r
SET session_id = rs.id
FROM public.repair_sessions rs
WHERE r.locomotive_id = rs.locomotive_id AND rs.status = 'active'
AND r.is_completed = false
AND r.session_id IS NULL; -- only update if not already set

-- 5. Data Migration: Link existing active checklists to the active session for that locomotive
UPDATE public.checklist_instances ci
SET session_id = rs.id
FROM public.repair_sessions rs
WHERE ci.locomotive_id = rs.locomotive_id AND rs.status = 'active'
AND ci.session_id IS NULL; -- only update if not already set

-- Optional: Link completed remarks to the active session as well (assuming they belong to the current cycle) if preferred.
-- Otherwise, they will remain without a session ID and represent historical orphaned data which is fine.
UPDATE public.locomotive_remarks r
SET session_id = rs.id
FROM public.repair_sessions rs
WHERE r.locomotive_id = rs.locomotive_id AND rs.status = 'active'
AND r.is_completed = true
AND r.session_id IS NULL;

-- 6. Setup Row-Level Security (RLS) policies for the new table (Assuming permissive for now similar to other tables)
ALTER TABLE public.repair_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to repair_sessions" 
ON public.repair_sessions FOR ALL TO authenticated USING (true);

-- Ensure public read isn't an issue if they rely on it in test env
CREATE POLICY "Allow public read access to repair_sessions" 
ON public.repair_sessions FOR SELECT TO anon USING (true);
