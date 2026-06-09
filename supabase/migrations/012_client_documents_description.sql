-- Adiciona campo de descrição/observações nos documentos
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS description text;
