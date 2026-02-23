-- ============================================
-- Yamazumi Locomotive Depot — Supabase Migration
-- ============================================
-- Запустите этот скрипт в Supabase Dashboard:
-- 1. Откройте https://supabase.com/dashboard
-- 2. Выберите ваш проект
-- 3. Перейдите в SQL Editor (левая панель)
-- 4. Вставьте этот скрипт и нажмите "Run"
-- ============================================

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
