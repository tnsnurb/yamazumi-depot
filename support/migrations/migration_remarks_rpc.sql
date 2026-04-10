-- RPC функции для атомарного управления замечаниями
-- Гарантируют синхронное обновление статуса, баллов, истории и журнала перемещений

-- 1. Выполнение/Отмена выполнения замечания
CREATE OR REPLACE FUNCTION complete_remark(
    p_remark_id INTEGER,
    p_user_id INTEGER,
    p_is_completed BOOLEAN,
    p_photo_url TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_remark RECORD;
    v_loco RECORD;
    v_user_name TEXT;
    v_points INTEGER;
    v_updated_remark JSONB;
BEGIN
    -- Получаем данные замечания и локомотива
    SELECT lr.*, l.number as loco_number, u.full_name, u.username
    INTO v_remark
    FROM locomotive_remarks lr
    JOIN locomotives l ON lr.locomotive_id = l.id
    LEFT JOIN users u ON u.id = p_user_id
    WHERE lr.id = p_remark_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Remark not found';
    END IF;

    v_user_name := COALESCE(v_remark.full_name, v_remark.username);
    v_points := COALESCE(v_remark.points, 10);

    -- Если статус не изменился, просто возвращаем текущее состояние
    IF v_remark.is_completed = p_is_completed THEN
        RETURN to_jsonb(v_remark);
    END IF;

    -- 1. Обновляем статус замечания
    UPDATE locomotive_remarks
    SET is_completed = p_is_completed,
        completed_by = CASE WHEN p_is_completed THEN p_user_id ELSE NULL END,
        completed_at = CASE WHEN p_is_completed THEN NOW() ELSE NULL END,
        completion_photo_url = CASE WHEN p_is_completed THEN p_photo_url ELSE completion_photo_url END,
        -- При отмене выполнения сбрасываем верификацию
        is_verified = CASE WHEN NOT p_is_completed THEN FALSE ELSE is_verified END,
        verified_by = CASE WHEN NOT p_is_completed THEN NULL ELSE verified_by END,
        verified_at = CASE WHEN NOT p_is_completed THEN NULL ELSE verified_at END
    WHERE id = p_remark_id
    RETURNING * INTO v_remark;

    -- 2. Обновляем баллы пользователя
    UPDATE users
    SET points = points + (CASE WHEN p_is_completed THEN v_points ELSE -v_points END)
    WHERE id = p_user_id;

    -- 3. Записываем в историю замечания
    INSERT INTO remark_history (remark_id, user_id, action, details)
    VALUES (
        p_remark_id,
        p_user_id,
        CASE WHEN p_is_completed THEN 'completed' ELSE 'reopened' END,
        CASE WHEN p_is_completed 
             THEN 'Выполнено (+' || v_points || ' б.)' 
             ELSE 'Отметка снята (-' || v_points || ' б.)' 
        END
    );

    -- 4. Записываем в журнал движений
    INSERT INTO movements (locomotive_id, locomotive_number, action, moved_by)
    VALUES (
        v_remark.locomotive_id,
        v_remark.loco_number,
        CASE WHEN p_is_completed THEN 'remark_completed: ' || v_remark.text ELSE 'remark_reopened: ' || v_remark.text END,
        v_user_name
    );

    RETURN to_jsonb(v_remark);
END;
$$ LANGUAGE plpgsql;

-- 2. Верификация замечания мастером
CREATE OR REPLACE FUNCTION verify_remark(
    p_remark_id INTEGER,
    p_user_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_remark RECORD;
    v_user_name TEXT;
    v_updated_remark JSONB;
BEGIN
    SELECT lr.*, l.number as loco_number, u.full_name, u.username
    INTO v_remark
    FROM locomotive_remarks lr
    JOIN locomotives l ON lr.locomotive_id = l.id
    LEFT JOIN users u ON u.id = p_user_id
    WHERE lr.id = p_remark_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Remark not found';
    END IF;

    IF NOT v_remark.is_completed THEN
        RAISE EXCEPTION 'Remark must be completed before verification';
    END IF;

    v_user_name := COALESCE(v_remark.full_name, v_remark.username);

    -- 1. Обновляем статус верификации
    UPDATE locomotive_remarks
    SET is_verified = TRUE,
        verified_by = p_user_id,
        verified_at = NOW()
    WHERE id = p_remark_id
    RETURNING * INTO v_remark;

    -- 2. Записываем в историю
    INSERT INTO remark_history (remark_id, user_id, action, details)
    VALUES (p_remark_id, p_user_id, 'verified', 'Проверено и принято');

    -- 3. Записываем в журнал движений
    INSERT INTO movements (locomotive_id, locomotive_number, action, moved_by)
    VALUES (v_remark.locomotive_id, v_remark.loco_number, 'remark_verified: ' || v_remark.text, v_user_name);

    RETURN to_jsonb(v_remark);
END;
$$ LANGUAGE plpgsql;

-- 3. Отклонение замечания мастером (возврат в работу)
CREATE OR REPLACE FUNCTION reject_remark(
    p_remark_id INTEGER,
    p_user_id INTEGER,
    p_comment TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_remark RECORD;
    v_user_name TEXT;
    v_points INTEGER;
    v_completer_id INTEGER;
BEGIN
    SELECT lr.*, l.number as loco_number, u.full_name, u.username
    INTO v_remark
    FROM locomotive_remarks lr
    JOIN locomotives l ON lr.locomotive_id = l.id
    LEFT JOIN users u ON u.id = p_user_id
    WHERE lr.id = p_remark_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Remark not found';
    END IF;

    IF NOT v_remark.is_completed THEN
        RAISE EXCEPTION 'Remark is not in completed state';
    END IF;

    v_user_name := COALESCE(v_remark.full_name, v_remark.username);
    v_points := COALESCE(v_remark.points, 10);
    v_completer_id := v_remark.completed_by;

    -- 1. Сбрасываем статус выполнения и верификации
    UPDATE locomotive_remarks
    SET is_completed = FALSE,
        completed_by = NULL,
        completed_at = NULL,
        is_verified = FALSE,
        verified_by = NULL,
        verified_at = NULL
    WHERE id = p_remark_id
    RETURNING * INTO v_remark;

    -- 2. Снимаем баллы с того, кто "выполнил" замечание (если он есть)
    IF v_completer_id IS NOT NULL THEN
        UPDATE users SET points = points - v_points WHERE id = v_completer_id;
    END IF;

    -- 3. Записываем в историю
    INSERT INTO remark_history (remark_id, user_id, action, details)
    VALUES (
        p_remark_id, 
        p_user_id, 
        'rejected', 
        'Отклонено и возвращено в работу (-' || v_points || ' б.)' || 
        CASE WHEN p_comment IS NOT NULL AND p_comment != '' THEN ' | Комментарий: "' || p_comment || '"' ELSE '' END
    );

    -- 4. Записываем в журнал движений
    INSERT INTO movements (locomotive_id, locomotive_number, action, moved_by)
    VALUES (
        v_remark.locomotive_id, 
        v_remark.loco_number, 
        'remark_rejected: ' || v_remark.text || CASE WHEN p_comment IS NOT NULL AND p_comment != '' THEN ' (Причина: ' || p_comment || ')' ELSE '' END, 
        v_user_name
    );

    RETURN to_jsonb(v_remark);
END;
$$ LANGUAGE plpgsql;
