-- Documentos do workspace (pessoais e compartilhados)
CREATE TABLE public.workspace_docs (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title       text NOT NULL DEFAULT 'Sem título',
  content     jsonb DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}',
  visibility  text NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'shared')),
  created_by  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.workspace_docs ENABLE ROW LEVEL SECURITY;

-- Pessoais: só o dono vê. Compartilhados: todos autenticados.
CREATE POLICY "workspace_docs_select" ON public.workspace_docs
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      visibility = 'shared' OR created_by = auth.uid()
    )
  );

CREATE POLICY "workspace_docs_insert" ON public.workspace_docs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

CREATE POLICY "workspace_docs_update" ON public.workspace_docs
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "workspace_docs_delete" ON public.workspace_docs
  FOR DELETE USING (created_by = auth.uid());

-- auto-atualiza updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER workspace_docs_updated_at
  BEFORE UPDATE ON public.workspace_docs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
