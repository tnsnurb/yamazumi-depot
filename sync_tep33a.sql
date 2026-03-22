-- Синхронизация локомотивов ТЭП33А (1-100) из справочника в рабочую таблицу
-- Это позволит выбирать их в разделе Метрология
INSERT INTO public.locomotives (series, number, status, location_id, created_at)
SELECT series, number, 'completed', 1, NOW()
FROM public.locomotive_catalog
WHERE series = 'ТЭП33А' 
  AND number ~ '^\d+$'
  AND CAST(number AS INTEGER) BETWEEN 1 AND 100
  AND NOT EXISTS (
    SELECT 1 FROM public.locomotives l 
    WHERE l.series = public.locomotive_catalog.series 
      AND l.number = public.locomotive_catalog.number
  );

-- Также добавим те, у которых номер с ведущими нулями (0001)
INSERT INTO public.locomotives (series, number, status, location_id, created_at)
SELECT series, number, 'completed', 1, NOW()
FROM public.locomotive_catalog
WHERE series = 'ТЭП33А' 
  AND number ~ '^0*\d+$'
  AND CAST(number AS INTEGER) BETWEEN 1 AND 100
  AND NOT EXISTS (
    SELECT 1 FROM public.locomotives l 
    WHERE l.series = public.locomotive_catalog.series 
      AND l.number = public.locomotive_catalog.number
  );
