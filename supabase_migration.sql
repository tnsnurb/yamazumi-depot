-- ============================================
-- Yamazumi Locomotive Depot — Supabase Migration
-- ============================================
-- Запустите этот скрипт в Supabase Dashboard:
-- 1. Откройте https://supabase.com/dashboard
-- 2. Выберите ваш проект
-- 3. Перейдите в SQL Editor (левая панель)
-- 4. Вставьте этот скрипт и нажмите "Run"
-- ============================================

-- 1. Create Roles Table (NEW)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  can_view_dashboard BOOLEAN DEFAULT false,
  can_view_map BOOLEAN DEFAULT true,
  can_view_journal BOOLEAN DEFAULT true,
  can_move_locomotives BOOLEAN DEFAULT false,
  can_edit_catalog BOOLEAN DEFAULT false,
  can_manage_users BOOLEAN DEFAULT false,
  can_complete_remarks BOOLEAN DEFAULT true
);

-- Insert default roles
INSERT INTO roles (name, description, can_view_dashboard, can_view_map, can_view_journal, can_move_locomotives, can_edit_catalog, can_manage_users, can_complete_remarks)
VALUES 
  ('admin', 'Полный доступ ко всем функциям и панели управления', true, true, true, true, true, true, true),
  ('employee', 'Доступ к карте и журналу', false, true, true, false, false, false, true)
ON CONFLICT (name) DO UPDATE SET 
  can_view_dashboard = EXCLUDED.can_view_dashboard,
  can_view_map = EXCLUDED.can_view_map,
  can_view_journal = EXCLUDED.can_view_journal,
  can_move_locomotives = EXCLUDED.can_move_locomotives,
  can_edit_catalog = EXCLUDED.can_edit_catalog,
  can_manage_users = EXCLUDED.can_manage_users,
  can_complete_remarks = EXCLUDED.can_complete_remarks;

-- ADD TO EXISTING (IF ALREADY CREATED):
ALTER TABLE roles 
  ADD COLUMN IF NOT EXISTS can_view_dashboard BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_map BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_journal BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_move_locomotives BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_catalog BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_complete_remarks BOOLEAN DEFAULT true;

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  barcode TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure barcode exists for existing db
ALTER TABLE users ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;

-- Таблица локомотивов
CREATE TABLE IF NOT EXISTS locomotives (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  track INTEGER CHECK (track >= 1 AND track <= 6),
  position INTEGER CHECK (position >= 1 AND position <= 6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(track, position)
);

-- Таблица перемещений (журнал)
CREATE TABLE IF NOT EXISTS movements (
  id SERIAL PRIMARY KEY,
  locomotive_id INTEGER NOT NULL REFERENCES locomotives(id) ON DELETE CASCADE,
  locomotive_number TEXT NOT NULL,
  from_track INTEGER,
  from_position INTEGER,
  to_track INTEGER,
  to_position INTEGER,
  action TEXT DEFAULT 'move',
  moved_at TIMESTAMPTZ DEFAULT NOW(),
  moved_by TEXT
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_locomotives_track ON locomotives(track, position);
CREATE INDEX IF NOT EXISTS idx_movements_loco ON movements(locomotive_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(moved_at DESC);

-- Дефолтный админ (пароль: admin123, bcrypt hash)
INSERT INTO users (username, password, full_name)
VALUES ('admin', '$2a$10$f5GkAicWVe0oX4K2V2iDquFJocbnXXM7jHCCjeTXyZOT40NkeM9iu', 'Администратор')
ON CONFLICT (username) DO NOTHING;

-- Таблица справочника локомотивов (Каталог)
CREATE TABLE IF NOT EXISTS locomotive_catalog (
  id SERIAL PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Locomotive Remarks Table
CREATE TABLE IF NOT EXISTS locomotive_remarks (
  id SERIAL PRIMARY KEY,
  locomotive_id INTEGER REFERENCES locomotives(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADD TO EXISTING (IF ALREADY CREATED):
ALTER TABLE locomotive_remarks 
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 5. Create Remark History Table
CREATE TABLE IF NOT EXISTS remark_history (
  id SERIAL PRIMARY KEY,
  remark_id UUID REFERENCES locomotive_remarks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Remark Comments Table
CREATE TABLE IF NOT EXISTS remark_comments (
  id SERIAL PRIMARY KEY,
  remark_id UUID REFERENCES locomotive_remarks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Remark Photos Table
CREATE TABLE IF NOT EXISTS remark_photos (
  id SERIAL PRIMARY KEY,
  remark_id UUID REFERENCES locomotive_remarks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================
-- AVATAR UPDATES
-- ==========================
-- 1. Add avatar_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO NOTHING;

-- 3. Create remark_attachments storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('remark_attachments', 'remark_attachments', true) 
ON CONFLICT (id) DO NOTHING;
