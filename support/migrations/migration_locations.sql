-- Шаг 1: Создание таблицы локаций (Депо / Станции)
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Шаг 2: Создание локации по умолчанию (Базовое депо), в котором вы сейчас работали
INSERT INTO locations (name) VALUES ('Депо 1 (Основное)') ON CONFLICT (name) DO NOTHING;

-- Шаг 3: Добавление location_id в таблицу сотрудников (users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
-- Всех текущих сотрудников привязываем к локации 1
UPDATE users SET location_id = 1 WHERE location_id IS NULL;

-- Шаг 4: Добавление location_id в таблицу локомотивов (locomotives - те, что на путях)
ALTER TABLE locomotives ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE;
-- Все текущие локомотивы привязываем к локации 1
UPDATE locomotives SET location_id = 1 WHERE location_id IS NULL;

-- Шаг 5: Добавление location_id в журнал движений (movements)
ALTER TABLE movements ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE;
-- Все текущие записи журнала привязываем к локации 1
UPDATE movements SET location_id = 1 WHERE location_id IS NULL;

-- Шаг 6: Настройка прав
GRANT ALL ON TABLE locations TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE locations_id_seq TO anon, authenticated, service_role;
