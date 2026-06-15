-- 031_fix_docs_select_policy.sql
-- Corrige recursão na policy SELECT de workspace_docs.
--
-- Problema: user_can_see_doc() fazia SELECT em workspace_docs,
-- disparando a própria policy SELECT novamente (recursão).
-- No INSERT ... RETURNING *, isso impedia de devolver a linha recém-criada.
--
-- Solução: inlinear os casos comuns (personal/shared) direto na policy
-- e criar user_has_doc_share() que só consulta workspace_doc_shares
-- (sem tocar em workspace_docs, sem recursão).

-- 1. Função auxiliar que verifica APENAS workspace_doc_shares
CREATE OR REPLACE FUNCTION public.user_has_doc_share(d_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_doc_shares
    WHERE doc_id = d_id AND user_id = auth.uid()
  );
$$;

-- 2. Reescreve a policy SELECT sem chamar funções que releem workspace_docs
DROP POLICY IF EXISTS "workspace_docs_select" ON public.workspace_docs;
CREATE POLICY "workspace_docs_select" ON public.workspace_docs
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      visibility = 'shared'
      OR created_by = auth.uid()
      OR (visibility = 'specific' AND public.user_has_doc_share(id))
    )
  );
