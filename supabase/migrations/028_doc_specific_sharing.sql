-- 028_doc_specific_sharing.sql
-- Compartilhamento de documentos com pessoas específicas.
-- visibility passa a aceitar 'specific' (além de 'personal' e 'shared').
-- Tabela workspace_doc_shares lista os usuários com acesso a um doc 'specific'.
-- RLS usa funções SECURITY DEFINER para evitar recursão entre as policies.

-- 1. permitir visibility 'specific'
ALTER TABLE public.workspace_docs DROP CONSTRAINT IF EXISTS workspace_docs_visibility_check;
ALTER TABLE public.workspace_docs
  ADD CONSTRAINT workspace_docs_visibility_check
  CHECK (visibility IN ('personal', 'shared', 'specific'));

-- 2. tabela de compartilhamentos
CREATE TABLE IF NOT EXISTS public.workspace_doc_shares (
  doc_id     uuid REFERENCES public.workspace_docs(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (doc_id, user_id)
);
ALTER TABLE public.workspace_doc_shares ENABLE ROW LEVEL SECURITY;

-- 3. helpers SECURITY DEFINER (bypassam RLS internamente -> sem recursão)
CREATE OR REPLACE FUNCTION public.is_doc_owner(d_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_docs d
    WHERE d.id = d_id AND d.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_doc(d_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_docs d
    WHERE d.id = d_id AND (
      d.visibility = 'shared'
      OR d.created_by = auth.uid()
      OR (d.visibility = 'specific' AND EXISTS (
        SELECT 1 FROM public.workspace_doc_shares s
        WHERE s.doc_id = d.id AND s.user_id = auth.uid()
      ))
    )
  );
$$;

-- 4. policies de workspace_doc_shares (dono gerencia; usuário vê o próprio acesso)
CREATE POLICY "doc_shares_select" ON public.workspace_doc_shares
  FOR SELECT USING (user_id = auth.uid() OR public.is_doc_owner(doc_id));
CREATE POLICY "doc_shares_insert" ON public.workspace_doc_shares
  FOR INSERT WITH CHECK (public.is_doc_owner(doc_id));
CREATE POLICY "doc_shares_delete" ON public.workspace_doc_shares
  FOR DELETE USING (public.is_doc_owner(doc_id));

-- 5. refaz o SELECT de workspace_docs incluindo o caso 'specific'
DROP POLICY IF EXISTS "workspace_docs_select" ON public.workspace_docs;
CREATE POLICY "workspace_docs_select" ON public.workspace_docs
  FOR SELECT USING (auth.role() = 'authenticated' AND public.user_can_see_doc(id));

CREATE INDEX IF NOT EXISTS idx_doc_shares_user ON public.workspace_doc_shares (user_id);
