-- 030_tasks_completed_at.sql
-- Registra quando uma tarefa foi concluída, para medir tempo até a conclusão.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
