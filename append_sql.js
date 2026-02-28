const fs = require('fs');
const sql = `-- ==========================
-- BARCODE UPDATE
-- ==========================
-- Add barcode column to public.users table (added to fix login error)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;
`;
fs.appendFileSync('supabase_migration.sql', sql);
