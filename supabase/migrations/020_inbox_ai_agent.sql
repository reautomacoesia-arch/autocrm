-- Agente de IA (SDR virtual) na inbox via WhatsApp
-- Permite desligar a IA por conversa e marcar mensagens geradas pelo agente.

ALTER TABLE public.inbox_conversations
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.inbox_messages
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

-- Lookup rápido por canal + contato (webhook do Z-API chega só com o telefone)
CREATE INDEX IF NOT EXISTS inbox_conversations_channel_handle_idx
  ON public.inbox_conversations(channel, contact_handle);
