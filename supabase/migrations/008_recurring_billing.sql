-- ── Migration 008: Recorrência Financeira ────────────────────────────────────
--
-- Adiciona suporte a cobranças mensais automáticas:
--  · billing_day em clients: dia do mês para gerar a transação (1-28)
--  · recurring_key em transactions: chave de deduplicação para transações
--    geradas automaticamente pelo cron (ex: "recurring:{clientId}:2025-06")
-- ─────────────────────────────────────────────────────────────────────────────

-- Dia de cobrança mensal no cliente (NULL = sem recorrência automática)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS billing_day int
    CHECK (billing_day >= 1 AND billing_day <= 28);

COMMENT ON COLUMN public.clients.billing_day IS
  'Dia do mês em que a transação mensal é gerada automaticamente (1–28). NULL = sem recorrência.';

-- Chave de deduplicação nas transações automáticas
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_key text;

-- Índice único: evita que o cron crie transação duplicada no mesmo mês
CREATE UNIQUE INDEX IF NOT EXISTS transactions_recurring_key_unique
  ON public.transactions (recurring_key)
  WHERE recurring_key IS NOT NULL;

COMMENT ON COLUMN public.transactions.recurring_key IS
  'Chave de deduplicação para transações geradas pelo cron. Formato: "recurring:{client_id}:{YYYY-MM}".';
