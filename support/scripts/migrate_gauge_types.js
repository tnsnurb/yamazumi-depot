const db = require('./db');

async function migrateGaugeTypes() {
    try {
        console.log('Начало миграции: Справочник манометров');

        // 1. Создание таблицы gauge_types
        await db.query(`
            CREATE TABLE IF NOT EXISTS public.gauge_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                part_number TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Таблица gauge_types создана.');

        // 2. Копирование уникальных парт-номеров из gauges
        // (на случай, если таблица gauges уже была создана ранее)
        await db.query(`
            INSERT INTO public.gauge_types (part_number, description)
            SELECT DISTINCT part_number, description
            FROM public.gauges
            WHERE part_number IS NOT NULL AND part_number != ''
            ON CONFLICT (part_number) DO NOTHING;
        `);
        console.log('✅ Существующие данные перенесены в справочник.');

        // 3. Добавление type_id в gauges (если его нет)
        await db.query(`
            ALTER TABLE public.gauges 
            ADD COLUMN IF NOT EXISTS type_id UUID REFERENCES public.gauge_types(id);
        `);
        console.log('✅ Колонка type_id добавлена в gauges.');

        // 4. Заполнение type_id
        await db.query(`
            UPDATE public.gauges g
            SET type_id = t.id
            FROM public.gauge_types t
            WHERE g.part_number = t.part_number
              AND g.type_id IS NULL;
        `);
        console.log('✅ Связи type_id установлены для существующих манометров.');

        // 5. Удаление старых текстовых колонок
        await db.query(`
            ALTER TABLE public.gauges 
            DROP COLUMN IF EXISTS part_number,
            DROP COLUMN IF EXISTS description;
        `);
        console.log('✅ Старые поля part_number и description удалены из gauges.');

        console.log('🎉 Миграция БД успешно завершена!');
    } catch (e) {
        console.error('❌ Ошибка миграции:', e);
    } finally {
        process.exit();
    }
}

migrateGaugeTypes();
