-- 027_expenses_client.sql
-- Permite vincular uma despesa a um cliente (opcional), para apurar lucro por cliente
-- (receita do cliente − custos atribuídos a ele). Ex.: custo mensal de ferramentas
-- dedicado a um cliente específico.
-- ON DELETE SET NULL: apagar o cliente não apaga a despesa (vira "Geral").

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_client_id ON public.expenses (client_id);
