-- 1. Добавляем колонку is_active в таблицу users, если ее еще нет
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Создаем таблицу audit_logs для журнала действий (с настроенными типами)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Выдаем права на чтение/запись для anon и authenticated ролей
GRANT ALL ON TABLE audit_logs TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE audit_logs_id_seq TO anon, authenticated, service_role;
