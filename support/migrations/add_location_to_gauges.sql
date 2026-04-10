-- Миграция: добавление локации к манометрам
-- 1. Добавление колонки
ALTER TABLE gauges ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);

-- 2. Миграция существующих данных

-- А) Для манометров на локомотивах - берем локацию локомотива
UPDATE gauges g
SET location_id = l.location_id
FROM locomotives l
WHERE g.locomotive_id = l.id
AND g.location_id IS NULL;

-- Б) Для остальных манометров - берем локацию из истории (кто последним трогал)
UPDATE gauges g
SET location_id = u.location_id
FROM (
    SELECT DISTINCT ON (gauge_id) gauge_id, created_by
    FROM gauge_history
    ORDER BY gauge_id, created_at DESC
) h
JOIN users u ON h.created_by = u.id
WHERE g.id = h.gauge_id
AND g.location_id IS NULL;

-- В) Фолбэк: если история пуста и локомотива нет, ставим депо 1 (Sekseul) или 2 (Aktobe)
-- Судя по анализу, большинство оставшихся тоже из Сексеула (KSK префикс)
UPDATE gauges 
SET location_id = 1 
WHERE location_id IS NULL;

-- 3. Делаем колонку обязательной для будущего
ALTER TABLE gauges ALTER COLUMN location_id SET NOT NULL;

-- 4. Индекс для ускорения фильтрации
CREATE INDEX IF NOT EXISTS idx_gauges_location_id ON gauges(location_id);

COMMENT ON COLUMN gauges.location_id IS 'ID депо (локации), к которому приписан манометр';
