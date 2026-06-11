-- Inbox Omnichannel — Núcleo (Fase 1)
-- Conversas e mensagens registradas manualmente, agnósticas de canal
-- (whatsapp / instagram / facebook). Quando integrações reais (UAZAPI etc.)
-- chegarem, elas só precisam inserir linhas aqui via webhook.

CREATE TABLE public.inbox_conversations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'facebook')),
  contact_name text NOT NULL,
  contact_handle text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.inbox_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_inbox_conversations" ON public.inbox_conversations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE public.inbox_messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id uuid REFERENCES public.inbox_conversations(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content text,
  attachment_r2_key text,
  attachment_name text,
  attachment_mime_type text,
  attachment_size integer,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT message_has_content CHECK (content IS NOT NULL OR attachment_r2_key IS NOT NULL)
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_inbox_messages" ON public.inbox_messages
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS inbox_messages_conversation_id_idx ON public.inbox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS inbox_conversations_last_message_at_idx ON public.inbox_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS inbox_conversations_status_idx ON public.inbox_conversations(status);

-- Mantém inbox_conversations.updated_at em dia (reusa função da migration 013)
CREATE TRIGGER inbox_conversations_updated_at
  BEFORE UPDATE ON public.inbox_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atualiza last_message_at / last_message_preview / updated_at da conversa a cada nova mensagem
CREATE OR REPLACE FUNCTION public.touch_inbox_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.inbox_conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = COALESCE(NEW.content, '[Anexo]'),
      updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER inbox_messages_touch_conversation
  AFTER INSERT ON public.inbox_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_inbox_conversation();
