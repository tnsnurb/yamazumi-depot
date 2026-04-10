-- ==========================================
-- MIGRATION: ENABLE RLS ON GAUGE TABLES
-- ==========================================

-- 1. Enable RLS
ALTER TABLE "public"."gauges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gauge_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gauge_types" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts (if any)
DROP POLICY IF EXISTS "Allow public read" ON "public"."gauge_types";
DROP POLICY IF EXISTS "Admins full access" ON "public"."gauge_types";

DROP POLICY IF EXISTS "Auth users read" ON "public"."gauges";
DROP POLICY IF EXISTS "Auth users insert" ON "public"."gauges";
DROP POLICY IF EXISTS "Auth users update" ON "public"."gauges";
DROP POLICY IF EXISTS "Admins delete" ON "public"."gauges";

DROP POLICY IF EXISTS "Auth users read" ON "public"."gauge_history";
DROP POLICY IF EXISTS "Auth users insert" ON "public"."gauge_history";
DROP POLICY IF EXISTS "Auth users update" ON "public"."gauge_history";
DROP POLICY IF EXISTS "Admins delete" ON "public"."gauge_history";

-- ==========================================
-- 3. Define Policies for gauge_types (Reference Table)
-- ==========================================
CREATE POLICY "Allow auth select gauge_types" ON "public"."gauge_types" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert gauge_types" ON "public"."gauge_types" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update gauge_types" ON "public"."gauge_types" FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow admin delete gauge_types" ON "public"."gauge_types" FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 4. Define Policies for gauges (Operational Table)
-- ==========================================
CREATE POLICY "Allow auth select gauges" ON "public"."gauges" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert gauges" ON "public"."gauges" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update gauges" ON "public"."gauges" FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow admin delete gauges" ON "public"."gauges" FOR DELETE TO authenticated USING (public.is_admin());

-- ==========================================
-- 5. Define Policies for gauge_history (Operational Table)
-- ==========================================
CREATE POLICY "Allow auth select gauge_history" ON "public"."gauge_history" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert gauge_history" ON "public"."gauge_history" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update gauge_history" ON "public"."gauge_history" FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow admin delete gauge_history" ON "public"."gauge_history" FOR DELETE TO authenticated USING (public.is_admin());

