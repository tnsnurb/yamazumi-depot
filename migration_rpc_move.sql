-- RPC функция для атомарного перемещения локомотива, записи в журнал и (опционально) смены статуса
-- Это гарантирует, что либо все действия выполнятся, либо ни одно.

CREATE OR REPLACE FUNCTION move_locomotive(
    p_loco_id INTEGER,
    p_track INTEGER,
    p_position INTEGER,
    p_reason TEXT,
    p_moved_by TEXT,
    p_location_id INTEGER,
    p_action_type TEXT DEFAULT 'move',
    p_status TEXT DEFAULT NULL -- Добавлен параметр для статуса (опционально)
) RETURNS JSONB AS $$
DECLARE
    v_old_track INTEGER;
    v_old_position INTEGER;
    v_loco_number TEXT;
    v_loco_series TEXT;
    v_updated_loco JSONB;
BEGIN
    -- 1. Получаем текущие данные локомотива
    SELECT track, position, number, series 
    INTO v_old_track, v_old_position, v_loco_number, v_loco_series
    FROM locomotives 
    WHERE id = p_loco_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Locomotive not found';
    END IF;

    -- 2. Проверяем, не занято ли место (если перемещаем на путь)
    IF p_track IS NOT NULL AND p_position IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM locomotives 
            WHERE track = p_track 
              AND position = p_position 
              AND location_id = p_location_id 
              AND id != p_loco_id
        ) THEN
            RAISE EXCEPTION 'Target position already occupied';
        END IF;
    END IF;

    -- 3. Обновляем позицию и статус локомотива
    UPDATE locomotives
    SET track = p_track,
        position = p_position,
        status = COALESCE(p_status, status) -- Обновляем статус, только если он передан
    WHERE id = p_loco_id
    RETURNING to_jsonb(locomotives.*) INTO v_updated_loco;

    -- 4. Записываем в журнал движений
    INSERT INTO movements (
        locomotive_id,
        locomotive_number,
        locomotive_series,
        from_track,
        from_position,
        to_track,
        to_position,
        action,
        moved_by,
        location_id
    ) VALUES (
        p_loco_id,
        v_loco_number,
        v_loco_series,
        v_old_track,
        v_old_position,
        p_track,
        p_position,
        CASE 
            WHEN p_reason IS NOT NULL AND p_reason != '' THEN p_action_type || ': ' || p_reason
            ELSE p_action_type
        END,
        p_moved_by,
        p_location_id
    );

    RETURN v_updated_loco;
END;
$$ LANGUAGE plpgsql;
