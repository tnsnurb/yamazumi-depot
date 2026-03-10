-- ==========================================
-- SUPABASE RLS MIGRATION SCRIPT (FIXED)
-- ==========================================

-- 1. Enable RLS on all existing tables
ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."repair_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."locomotive_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."locomotives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."locomotive_remarks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."remark_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."remark_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checklist_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checklist_template_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checklist_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checklist_instance_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checklist_item_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checklist_item_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."checklist_item_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DO $$ 
DECLARE 
    tbl RECORD;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "Allow All" ON "public"."' || tbl.tablename || '"';
        EXECUTE 'DROP POLICY IF EXISTS "Allow public read" ON "public"."' || tbl.tablename || '"';
        EXECUTE 'DROP POLICY IF EXISTS "Admins full access" ON "public"."' || tbl.tablename || '"';
        EXECUTE 'DROP POLICY IF EXISTS "Auth users read" ON "public"."' || tbl.tablename || '"';
        EXECUTE 'DROP POLICY IF EXISTS "Auth users insert" ON "public"."' || tbl.tablename || '"';
        EXECUTE 'DROP POLICY IF EXISTS "Auth users update" ON "public"."' || tbl.tablename || '"';
        EXECUTE 'DROP POLICY IF EXISTS "Admins delete" ON "public"."' || tbl.tablename || '"';
    END LOOP;
END $$;

-- ==========================================
-- 3. Define Policies
-- ==========================================

-- --- PUBLIC/REFERENCE TABLES (Read allowed for everyone, Write for Admins) ---
-- Tables: locations, repair_types, roles, locomotive_catalog, checklist_templates, checklist_template_items, remark_templates

DO $$ 
DECLARE 
    t TEXT;
    public_tables TEXT[] := ARRAY['locations', 'repair_types', 'roles', 'locomotive_catalog', 'checklist_templates', 'checklist_template_items', 'remark_templates'];
BEGIN 
    FOREACH t IN ARRAY public_tables LOOP
        EXECUTE format('CREATE POLICY "Allow public read" ON "public".%I FOR SELECT USING (true)', t);
        EXECUTE format('CREATE POLICY "Admins full access" ON "public".%I FOR ALL TO authenticated USING (auth.jwt() ->> ''role'' = ''admin'')', t);
    END LOOP;
END $$;

-- --- OPERATIONAL TABLES (Authenticated only) ---
-- Tables: locomotives, locomotive_remarks, remark_comments, checklist_instances, checklist_instance_items, checklist_item_history, checklist_item_comments, checklist_item_photos, movements

DO $$ 
DECLARE 
    t TEXT;
    op_tables TEXT[] := ARRAY['locomotives', 'locomotive_remarks', 'remark_comments', 'checklist_instances', 'checklist_instance_items', 'checklist_item_history', 'checklist_item_comments', 'checklist_item_photos', 'movements'];
BEGIN 
    FOREACH t IN ARRAY op_tables LOOP
        EXECUTE format('CREATE POLICY "Auth users read" ON "public".%I FOR SELECT TO authenticated USING (true)', t);
        EXECUTE format('CREATE POLICY "Auth users insert" ON "public".%I FOR INSERT TO authenticated WITH CHECK (true)', t);
        EXECUTE format('CREATE POLICY "Auth users update" ON "public".%I FOR UPDATE TO authenticated USING (true)', t);
        EXECUTE format('CREATE POLICY "Admins delete" ON "public".%I FOR DELETE TO authenticated USING (auth.jwt() ->> ''role'' = ''admin'')', t);
    END LOOP;
END $$;

-- --- SENSITIVE TABLES (Admin only access) ---
-- Tables: users, audit_logs

-- Users table: Anyone can read (to see names on login page), but only admins can manage
CREATE POLICY "Public users read users" ON "public"."users" FOR SELECT USING (true);
CREATE POLICY "Admins manage users" ON "public"."users" FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- Audit logs: Admins can see everything, system can write
CREATE POLICY "Admins read audit" ON "public"."audit_logs" FOR SELECT TO authenticated USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "System write audit" ON "public"."audit_logs" FOR INSERT TO authenticated WITH CHECK (true);

-- ==========================================
-- 4. Note on Storage
-- ==========================================
-- Storage policies for buckets (avatars, remark_attachments) must be configured in the Supabase Storage dashboard.
-- Recommended: "Authenticated" users have Fill Access, "Anon" users have no access.
