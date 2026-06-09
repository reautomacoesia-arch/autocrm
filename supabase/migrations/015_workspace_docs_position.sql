-- Coluna de ordenação manual nas páginas
ALTER TABLE public.workspace_docs
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Inicializa posições para páginas existentes (baseado em created_at)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY created_at) - 1 AS pos
  FROM public.workspace_docs
  WHERE parent_id IS NOT NULL
)
UPDATE public.workspace_docs w
SET position = ranked.pos
FROM ranked
WHERE w.id = ranked.id;
