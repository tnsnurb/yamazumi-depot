-- Шаг 1: Добавление колонки is_global_admin в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_global_admin BOOLEAN DEFAULT FALSE;

-- Даем главному администратору глобальные права
UPDATE users SET is_global_admin = TRUE WHERE username = 'admin';

-- Шаг 2: Добавление колонки is_active в таблицу locations (Депо)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
