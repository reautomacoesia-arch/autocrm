-- Permite o novo tipo 'task_update' na tabela de interações
ALTER TABLE public.interactions
  DROP CONSTRAINT IF EXISTS interactions_type_check;

ALTER TABLE public.interactions
  ADD CONSTRAINT interactions_type_check
  CHECK (type IN ('note', 'meeting', 'email', 'task_update'));
