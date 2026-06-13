-- 022_lead_scoring.sql
-- Lead Scoring com IA: pontuação de temperatura (0-100) por lead, calculada pelo Gemini.
-- As colunas herdam as policies de RLS já existentes da tabela leads (nenhuma policy nova).

ALTER TABLE leads ADD COLUMN IF NOT EXISTS score smallint;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scored_at timestamptz;

-- Índice para ordenar o kanban pelos leads mais quentes (não pontuados ficam por último).
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads (score DESC NULLS LAST);
