-- Шаг 1: Добавление настроек карты в таблицу locations
ALTER TABLE locations ADD COLUMN IF NOT EXISTS track_count INTEGER DEFAULT 6;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS slot_count INTEGER DEFAULT 6;

-- Обновление существующих депо (по умолчанию 6 путей, 6 слотов, как было раньше)
UPDATE locations SET track_count = 6, slot_count = 6 WHERE track_count IS NULL;
