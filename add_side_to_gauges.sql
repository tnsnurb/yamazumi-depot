-- Миграция: добавление стороны установки манометра (K1/K2)
ALTER TABLE gauges ADD COLUMN installation_side text;
ALTER TABLE gauges ADD CONSTRAINT gauges_installation_side_check CHECK (installation_side IN ('K1', 'K2'));

COMMENT ON COLUMN gauges.installation_side IS 'Сторона (кабина) установки манометра на локомотиве';
