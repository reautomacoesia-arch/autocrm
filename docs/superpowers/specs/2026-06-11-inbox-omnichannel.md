# Spec: Inbox Omnichannel — Núcleo (Fase 1)

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase, Cloudflare R2 (anexos).

Nova seção **Inbox** no CRM, agnóstica de canal mas já estruturada para `whatsapp` / `instagram` / `facebook`. Na Fase 1, conversas e mensagens são criadas/registradas **manualmente** pelo time (sem integração real com nenhuma API de mensageria). Quando a integração real do WhatsApp (via **UAZAPI**) e futuramente Instagram/Facebook chegarem, elas só precisam inserir linhas em `inbox_conversations`/`inbox_messages` via webhook — UI, vínculo com CRM, anexos e notificações já funcionam sem mudanças.

---

## 1. Banco de Dados (migration `019_inbox.sql`)

### Tabela `inbox_conversations`

```sql
CREATE TABLE public.inbox_conversations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'facebook')),
  contact_name text NOT NULL,
  contact_handle text,                         -- telefone, @usuário, etc. (livre)
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.inbox_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_inbox_conversations" ON public.inbox_conversations
  FOR ALL USING (auth.role() = 'authenticated');
```

- `lead_id`/`client_id` nulos = conversa "avulsa".
- `contact_handle`: campo livre (telefone com DDI para whatsapp, `@usuario` para instagram/facebook).

### Tabela `inbox_messages`

```sql
CREATE TABLE public.inbox_messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id uuid REFERENCES public.inbox_conversations(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content text,                                -- texto (pode ser nulo se só anexo)
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
```

- `direction`: `inbound` = mensagem do contato (registrada manualmente pelo time, descrevendo o que ele recebeu no WhatsApp/IG/FB); `outbound` = mensagem enviada pelo time (`sender_id` = quem registrou).

### Triggers

```sql
-- Mantém inbox_conversations.updated_at em dia (reusa função já existente da migration 013)
CREATE TRIGGER inbox_conversations_updated_at
  BEFORE UPDATE ON public.inbox_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atualiza last_message_at/updated_at da conversa a cada nova mensagem
CREATE OR REPLACE FUNCTION public.touch_inbox_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.inbox_conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER inbox_messages_touch_conversation
  AFTER INSERT ON public.inbox_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_inbox_conversation();
```

---

## 2. Tipos TypeScript (`lib/types.ts`)

```ts
export type InboxChannel = 'whatsapp' | 'instagram' | 'facebook'
export type ConversationStatus = 'open' | 'pending' | 'resolved'
export type MessageDirection = 'inbound' | 'outbound'

export interface InboxConversation {
  id: string
  channel: InboxChannel
  contact_name: string
  contact_handle: string | null
  lead_id: string | null
  client_id: string | null
  status: ConversationStatus
  assigned_to: string | null
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface InboxMessage {
  id: string
  conversation_id: string
  direction: MessageDirection
  content: string | null
  attachment_r2_key: string | null
  attachment_name: string | null
  attachment_mime_type: string | null
  attachment_size: number | null
  sender_id: string | null
  created_at: string
}
```

### `SOURCE_LABELS`

Adicionar `facebook: 'Facebook'` ao `SOURCE_LABELS` existente (`lib/types.ts:27`), usado quando uma conversa avulsa do canal Facebook vira Lead.

---

## 3. Navegação

Novo item no `navItems` de `components/layout/Sidebar.tsx`, logo após "Dashboard":

```ts
{ href: '/inbox', icon: Inbox, label: 'Inbox' }
```

(`Inbox` importado de `lucide-react`, já disponível no pacote.)

---

## 4. UI — Layout `/inbox`

Duas colunas, estilo cliente de e-mail.

### Coluna esquerda — lista de conversas (~340px)

- Header: "Inbox" + botão dourado "+ Nova conversa"
- Busca por `contact_name`/`contact_handle`
- Filtros de status: `Todas` · `Minhas` (assigned_to = usuário logado) · `Abertas` · `Pendentes` · `Resolvidas`
- Filtro de canal: `Todos` · `WhatsApp` · `Instagram` · `Facebook`
- Ordenação: `last_message_at DESC NULLS LAST, created_at DESC`
- Cada item:
  - Avatar com iniciais (mesmo padrão do `ProfileAvatar`)
  - Nome do contato + badge de canal (ícone + label, tom neutro/dourado da paleta Korvus — sem usar cores oficiais das plataformas)
  - Preview da última mensagem (truncado, 1 linha) + tempo relativo (`timeAgo`, reaproveitado de `NotificationBell`)
  - Badge de status: Aberta (emerald) · Pendente (amber) · Resolvida (slate)
  - Avatar pequeno do responsável, se `assigned_to` definido
  - Indicador discreto "Sem vínculo" se `lead_id` e `client_id` forem nulos

### Coluna direita — thread

- Header da conversa:
  - Nome + badge de canal
  - Se vinculada: chip clicável "→ Lead: {nome}" ou "→ Cliente: {nome}" (leva ao pipeline/ficha do cliente)
  - Se não vinculada: botões "Vincular a Lead/Cliente" (modal de busca, reaproveitando componente de busca já usado em outros lugares) e "+ Criar Lead"
  - Dropdown de status (`open`/`pending`/`resolved`) e dropdown de responsável (lista de `profiles`)
- Mensagens (scroll cronológico, `created_at ASC`, sem paginação na Fase 1):
  - Bolhas outbound à direita (dourado/obsidian), inbound à esquerda (obsidian neutro)
  - Conteúdo renderizado conforme `attachment_mime_type`:
    - `image/*` → thumbnail clicável (lightbox)
    - `video/*` → player inline
    - `audio/*` → player inline
    - outros/nenhum mime de mídia → ícone genérico + `attachment_name` + `attachment_size` + link de download
    - `content` (texto), se presente, exibido junto/abaixo do anexo
  - Timestamp + nome de quem registrou (via `sender_id`, para outbound)
- Composer: toggle segmentado **"Mensagem do contato" / "Minha resposta"** define `direction` (`inbound`/`outbound`) da mensagem a registrar. Abaixo: textarea + botão de anexo + botão "Registrar".

### Modal "+ Nova conversa"

1. Seleciona canal (WhatsApp / Instagram / Facebook)
2. Escolhe:
   - **Vincular a Lead/Cliente existente** (busca) → pré-preenche `contact_name` (nome do lead/cliente) e `contact_handle` (telefone, ou `instagram` se canal = Instagram), ambos editáveis
   - **Contato avulso** → `contact_name` (obrigatório) + `contact_handle` (opcional)
3. Cria a conversa vazia (`status = 'open'`, sem mensagens) e abre a thread

### "+ Criar Lead" (a partir de conversa avulsa)

Cria um `Lead` com:
- `name = contact_name`
- `source = channel` (`whatsapp`/`instagram`/`facebook` — todos já existem ou serão adicionados a `SOURCE_LABELS`)
- `phone = contact_handle` se `channel = 'whatsapp'`
- `instagram = contact_handle` se `channel = 'instagram'`
- `channel = 'facebook'` → `contact_handle` não é mapeado para nenhum campo do Lead (fica disponível só na conversa)

Vincula `inbox_conversations.lead_id` ao novo lead.

---

## 5. Anexos (reaproveitando R2 dos documentos de cliente)

Mesmo padrão de `app/api/clients/[id]/documents/presign/route.ts` (`lib/r2.ts`, `R2_BUCKET`, limite de **500 MB**, `r2_key` com prefixo aleatório):

- `POST /api/inbox/conversations/[id]/messages/presign` → `{ name, size, mime_type }` → retorna `{ upload_url, r2_key }`
- `GET /api/inbox/messages/[id]/attachment?preview=true` → URL assinada de visualização/download (`GetObjectCommand` + `getSignedUrl`)

---

## 6. Rotas de API

| Rota | Método | Descrição |
|---|---|---|
| `/api/inbox/conversations` | GET | Lista conversas (filtros: `status`, `channel`, `assigned_to=me`, busca por `contact_name`/`contact_handle`) |
| `/api/inbox/conversations` | POST | Cria conversa (Modal "+ Nova conversa") |
| `/api/inbox/conversations/[id]` | GET | Detalhe da conversa |
| `/api/inbox/conversations/[id]` | PATCH | Atualiza `status`, `assigned_to`, `lead_id`, `client_id` |
| `/api/inbox/conversations/[id]/messages` | GET | Lista mensagens da conversa (`created_at ASC`) |
| `/api/inbox/conversations/[id]/messages` | POST | Registra mensagem (texto e/ou metadados de anexo + `direction`) |
| `/api/inbox/conversations/[id]/messages/presign` | POST | URL assinada de upload (R2) |
| `/api/inbox/messages/[id]/attachment` | GET | URL assinada de download/preview (R2) |
| `/api/inbox/conversations/[id]/lead` | POST | "+ Criar Lead" a partir de conversa avulsa |

---

## 7. Atualização (polling)

- **Lista de conversas**: revalida a cada **15s**.
- **Thread aberta**: revalida a cada **5s**.
- Implementação: `setInterval` simples, mesmo padrão do `NotificationBell` (sem lógica de pausar fora de foco na Fase 1).
- Ao detectar mensagens novas na thread aberta, scroll automático para o fim.

---

## 8. Notificações

Quando uma `inbox_message` com `direction = 'inbound'` é inserida numa conversa com `assigned_to` definido, criar uma `notification` (tabela existente, `lib/automations.ts`/automation engine) para o responsável:

- `title`: `Nova mensagem de {contact_name}`
- `body`: preview do `content` (ou `"[Anexo]"` se só houver anexo)
- `link`: `/inbox?conversation={id}`

Reaproveita o `NotificationBell` já existente — sem nova UI de notificação.

---

## 9. Fora de escopo (Fase 1)

- Integrações reais com APIs de mensageria (WhatsApp via **UAZAPI**, Instagram, Facebook) — webhooks recebendo mensagens automaticamente. Specs futuras só inserem linhas em `inbox_conversations`/`inbox_messages`.
- Envio automático de mensagens para os canais — permanece manual (registro do que foi enviado).
- Templates / respostas rápidas, confirmação de leitura, "digitando...".
- Busca por conteúdo das mensagens (apenas por `contact_name`/`contact_handle`).
- Automações disparadas por eventos do Inbox (ex.: criar lead automaticamente ao iniciar conversa avulsa) — fica para spec futura do motor de automações.
- Múltiplas contas/números por canal (ex.: 2 números de WhatsApp).
- Supabase Realtime (decisão: polling simples na Fase 1; revisitar quando a integração real via UAZAPI chegar).

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `supabase/migrations/019_inbox.sql` | Criar — tabelas `inbox_conversations`, `inbox_messages`, RLS, triggers |
| `lib/types.ts` | Adicionar `InboxChannel`, `ConversationStatus`, `MessageDirection`, `InboxConversation`, `InboxMessage`, `facebook` em `SOURCE_LABELS` |
| `app/api/inbox/conversations/route.ts` | Criar — GET (lista + filtros) / POST (cria) |
| `app/api/inbox/conversations/[id]/route.ts` | Criar — GET / PATCH |
| `app/api/inbox/conversations/[id]/messages/route.ts` | Criar — GET / POST |
| `app/api/inbox/conversations/[id]/messages/presign/route.ts` | Criar — POST (presign R2) |
| `app/api/inbox/conversations/[id]/lead/route.ts` | Criar — POST ("+ Criar Lead") |
| `app/api/inbox/messages/[id]/attachment/route.ts` | Criar — GET (presign download/preview) |
| `components/layout/Sidebar.tsx` | Modificar — adicionar item "Inbox" |
| `app/(dashboard)/inbox/page.tsx` | Criar — página `/inbox` (layout 2 colunas) |
| `components/inbox/ConversationList.tsx` | Criar — coluna esquerda (lista, busca, filtros) |
| `components/inbox/ConversationThread.tsx` | Criar — coluna direita (header, mensagens, composer) |
| `components/inbox/NewConversationModal.tsx` | Criar — modal "+ Nova conversa" |
| `components/inbox/LinkLeadClientModal.tsx` | Criar — modal "Vincular a Lead/Cliente" |
