-- 025_leads_missing_columns.sql
-- Corrige drift de schema: o código (tipo Lead, AddLeadModal, KanbanCard, rotas
-- /api/leads) usa as colunas source/instagram/website/next_step, mas elas nunca
-- foram criadas por migration. O banco de produção está sem `next_step` (e possivelmente
-- outras), quebrando a criação/edição de leads com:
--   "Could not find the 'next_step' column of 'leads' in the schema cache"
-- IF NOT EXISTS torna seguro rodar mesmo se alguma já existir.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_step text;

-- Garante que o PostgREST recarregue o cache de schema imediatamente
-- (senão o erro "schema cache" pode persistir por alguns minutos).
NOTIFY pgrst, 'reload schema';
