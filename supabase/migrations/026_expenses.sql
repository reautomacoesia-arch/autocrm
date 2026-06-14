-- 026_expenses.sql
-- Despesas/gastos da empresa (separado de transactions, que são receitas de clientes).
-- Recorrência espelha a cobrança recorrente de clientes (008_recurring_billing):
--   um "template" (recurring=true, recurring_day) gera uma instância concreta por mês
--   via cron, dedupada por recurring_key = "expense:{templateId}:{YYYY-MM}".
--   Totais/relatórios somam apenas linhas com recurring=false (instâncias + avulsas);
--   templates (recurring=true) são só definições e não entram nos totais.

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  category text,
  date date NOT NULL DEFAULT current_date,
  recurring boolean NOT NULL DEFAULT false,
  recurring_day smallint,
  recurring_key text,
  parent_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_expenses" ON public.expenses FOR ALL USING (auth.role() = 'authenticated');

CREATE UNIQUE INDEX IF NOT EXISTS expenses_recurring_key_unique
  ON public.expenses (recurring_key) WHERE recurring_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (date);
