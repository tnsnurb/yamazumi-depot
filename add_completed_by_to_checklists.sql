ALTER TABLE public.checklist_instances ADD COLUMN IF NOT EXISTS completed_by INTEGER REFERENCES public.users(id);
