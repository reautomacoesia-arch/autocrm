-- Vincula propostas geradas no app gerador_propostas (IA, assinatura, pagamento)
-- a um registro espelho na tabela proposals do autocrm.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS external_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS external_url text;
