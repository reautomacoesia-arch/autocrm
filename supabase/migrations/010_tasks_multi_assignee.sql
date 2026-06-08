-- Suporte a múltiplos responsáveis por tarefa.
-- assigned_to_ids armazena um array de profile IDs.
-- Os campos legados assigned_to / assigned_to_id são mantidos para compatibilidade.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to_ids text[] DEFAULT '{}';
