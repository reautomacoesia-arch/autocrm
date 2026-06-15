-- 029_pipeline_stages.sql
-- Estágios de pipeline customizáveis (criar/renomear/reordenar/excluir colunas).
-- Abordagem por SLUG: leads.stage continua sendo texto (o slug do estágio); os
-- estágios atuais são semeados com os MESMOS slugs já usados, então NENHUM lead
-- precisa ser migrado. Metadados (type/probability/color/position) mantêm
-- automações (ganho/perdido), taxa de ganho e forecast funcionando.

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  label       text NOT NULL,
  color       text NOT NULL DEFAULT '#64748b',
  type        text NOT NULL DEFAULT 'open' CHECK (type IN ('open', 'won', 'lost')),
  probability numeric NOT NULL DEFAULT 0.3,   -- 0..1, usado no forecast (estágios 'open')
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_pipeline_stages" ON public.pipeline_stages
  FOR ALL USING (auth.role() = 'authenticated');

-- Semeia com os estágios atuais (mesmos slugs que leads.stage já usa)
INSERT INTO public.pipeline_stages (slug, label, color, type, probability, position) VALUES
  ('lead',          'Lead',             '#64748b', 'open', 0.10, 0),
  ('contacted',     'Contato feito',    '#3b82f6', 'open', 0.25, 1),
  ('proposal_sent', 'Proposta enviada', '#f59e0b', 'open', 0.50, 2),
  ('negotiating',   'Negociando',       '#a855f7', 'open', 0.75, 3),
  ('won',           'Fechado',          '#22c55e', 'won',  1.00, 4),
  ('lost',          'Perdido',          '#ef4444', 'lost', 0.00, 5)
ON CONFLICT (slug) DO NOTHING;

-- Remove o CHECK fixo de leads.stage (agora os estágios são dinâmicos)
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_stage_check;
