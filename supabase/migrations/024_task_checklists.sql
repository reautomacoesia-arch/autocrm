-- 024_task_checklists.sql
-- Permite múltiplas checklists nomeadas por tarefa (antes havia só uma lista plana).
-- Cada item passa a pertencer a uma checklist (checklist_id). Os itens antigos
-- (soltos) são migrados para uma checklist padrão "Checklist" da própria tarefa.

-- 1. Nova tabela de checklists
CREATE TABLE IF NOT EXISTS public.task_checklists (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'Checklist',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_task_checklists" ON public.task_checklists FOR ALL USING (auth.role() = 'authenticated');

-- 2. Liga itens a uma checklist
ALTER TABLE public.task_checklist_items
  ADD COLUMN IF NOT EXISTS checklist_id uuid REFERENCES public.task_checklists(id) ON DELETE CASCADE;

-- 3. Backfill: cria uma checklist padrão por tarefa que já tinha itens soltos
INSERT INTO public.task_checklists (task_id, title, position)
SELECT DISTINCT task_id, 'Checklist', 0
FROM public.task_checklist_items
WHERE checklist_id IS NULL;

-- 4. Vincula os itens soltos à checklist padrão da sua tarefa
UPDATE public.task_checklist_items i
SET checklist_id = c.id
FROM public.task_checklists c
WHERE i.checklist_id IS NULL
  AND c.task_id = i.task_id
  AND c.title = 'Checklist'
  AND c.position = 0;

-- 5. Índice para buscar itens por checklist
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_checklist
  ON public.task_checklist_items (checklist_id);
