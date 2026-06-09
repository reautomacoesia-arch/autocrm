-- Adiciona suporte a páginas dentro de documentos (cadernos)
ALTER TABLE public.workspace_docs
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.workspace_docs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS workspace_docs_parent_id_idx ON public.workspace_docs(parent_id);
