# Inbox Omnichannel — Núcleo (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o núcleo do Inbox Omnichannel (Fase 1): nova seção `/inbox` no AutoCRM onde o time registra manualmente conversas e mensagens dos canais WhatsApp/Instagram/Facebook, vinculáveis a Leads/Clientes existentes, com suporte a anexos via R2 e notificações para o responsável.

**Architecture:** A migration `019_inbox.sql` cria as tabelas `inbox_conversations`/`inbox_messages` (RLS + triggers que mantêm `last_message_at`/`last_message_preview`/`updated_at` em dia). Rotas de API sob `app/api/inbox/**` seguem os padrões já usados em `app/api/clients/[id]/documents/**` (Supabase via `lib/supabase/server`, anexos via `lib/r2` com presign R2). A UI é um layout de 2 colunas (`InboxClient`, client component) que orquestra `ConversationList` (busca/filtros) e `ConversationThread` (header, mensagens via `MessageBubble`, composer com anexo), com polling de 15s (lista) e 5s (thread aberta) no mesmo padrão do `NotificationBell`. Modais `NewConversationModal` e `LinkLeadModal` reaproveitam `Modal`/`useToast`/`useConfirm`.

**Tech Stack:** Next.js 16 App Router (Server Components + Route Handlers, `params`/`searchParams` como `Promise`), TypeScript estrito (`tsconfig.json` com `strict: true`, alias `@/*`), Supabase (Postgres + RLS), Cloudflare R2 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`), Tailwind CSS v4 (paleta Korvus / Neural Gold), Vitest + Testing Library.

---

## Nota sobre a migration (Task 1)

As migrations deste projeto (`supabase/migrations/001_*.sql` … `018_*.sql`) são apenas arquivos SQL versionados — não há Supabase CLI configurado localmente (sem `supabase/config.toml`) nem script de apply automático no `package.json`. A Task 1 portanto **apenas cria o arquivo** `019_inbox.sql`; a aplicação no projeto Supabase do AutoCRM é feita pelo time fora deste plano (mesmo fluxo das migrations anteriores). As FKs para `public.leads`, `public.clients` e `public.profiles` e a função `public.set_updated_at()` (criada em `013_workspace_docs.sql`) já existem no schema do AutoCRM (confirmado lendo `001_initial_schema.sql` e `013_workspace_docs.sql`).

---

### Task 1: Migration `019_inbox.sql`

**Files:**
- Create: `supabase/migrations/019_inbox.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
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
```

- [ ] **Step 2: Revisão manual**

Conferir no arquivo criado:
- `public.leads`, `public.clients`, `public.profiles` existem (`001_initial_schema.sql`, `005_profiles.sql`) — FKs válidas.
- `public.set_updated_at()` existe (`013_workspace_docs.sql`) — reusada no trigger `inbox_conversations_updated_at`.
- Os 3 `CHECK` (`channel`, `status`, `direction`) e a constraint `message_has_content` batem com os tipos TypeScript que serão criados na Task 2.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/019_inbox.sql
git commit -m "feat: migration do Inbox Omnichannel (conversas e mensagens)"
```

---

### Task 2: Tipos TypeScript (`lib/types.ts`)

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Adicionar os novos type aliases**

Em `lib/types.ts:8`, logo após `export type InteractionType = 'note' | 'meeting' | 'email' | 'task_update'`, adicionar:

```ts
export type InboxChannel = 'whatsapp' | 'instagram' | 'facebook'
export type ConversationStatus = 'open' | 'pending' | 'resolved'
export type MessageDirection = 'inbound' | 'outbound'
```

- [ ] **Step 2: Adicionar `facebook` em `SOURCE_LABELS`**

Em `lib/types.ts`, no objeto `SOURCE_LABELS` (linha 27-34), adicionar `facebook: 'Facebook',` logo após `whatsapp: 'WhatsApp',`:

```ts
export const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  indicacao: 'Indicação',
  site: 'Site',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  outro: 'Outro',
}
```

- [ ] **Step 3: Adicionar as interfaces `InboxConversation` e `InboxMessage`**

No final de `lib/types.ts` (após a interface `Notification`), adicionar:

```ts
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
  last_message_preview: string | null
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

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `lib/types.ts` (o projeto pode já ter erros pré-existentes em outros arquivos — confirme que nenhum novo erro aponta para `lib/types.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts
git commit -m "feat: tipos do Inbox Omnichannel (InboxConversation, InboxMessage)"
```

---

### Task 3: Helpers do Inbox (`lib/inbox.ts`)

**Files:**
- Create: `lib/inbox.ts`
- Test: `__tests__/inbox-lib.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/inbox-lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  CHANNEL_LABELS,
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  timeAgo,
  formatFileSize,
} from '@/lib/inbox'

describe('CHANNEL_LABELS', () => {
  it('mapeia os canais para labels em português', () => {
    expect(CHANNEL_LABELS.whatsapp).toBe('WhatsApp')
    expect(CHANNEL_LABELS.instagram).toBe('Instagram')
    expect(CHANNEL_LABELS.facebook).toBe('Facebook')
  })
})

describe('STATUS_LABELS e STATUS_BADGE_VARIANT', () => {
  it('mapeia os status para labels e variantes de badge', () => {
    expect(STATUS_LABELS.open).toBe('Aberta')
    expect(STATUS_LABELS.pending).toBe('Pendente')
    expect(STATUS_LABELS.resolved).toBe('Resolvida')
    expect(STATUS_BADGE_VARIANT.open).toBe('green')
    expect(STATUS_BADGE_VARIANT.pending).toBe('yellow')
    expect(STATUS_BADGE_VARIANT.resolved).toBe('gray')
  })
})

describe('timeAgo', () => {
  it('retorna "agora" para datas muito recentes', () => {
    const now = new Date().toISOString()
    expect(timeAgo(now)).toBe('agora')
  })

  it('retorna minutos para datas há poucos minutos', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(timeAgo(fiveMinAgo)).toBe('há 5min')
  })
})

describe('formatFileSize', () => {
  it('formata bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formata kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB')
  })

  it('formata megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('formata gigabytes', () => {
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/inbox-lib.test.ts`
Expected: FAIL — `Cannot find module '@/lib/inbox'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `lib/inbox.ts`**

```ts
import type { ConversationStatus, InboxChannel } from './types'

export const CHANNEL_LABELS: Record<InboxChannel, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
}

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Aberta',
  pending: 'Pendente',
  resolved: 'Resolvida',
}

export const STATUS_BADGE_VARIANT: Record<ConversationStatus, 'green' | 'yellow' | 'gray'> = {
  open: 'green',
  pending: 'yellow',
  resolved: 'gray',
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'agora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/inbox-lib.test.ts`
Expected: PASS — 4 describe blocks, 8 testes, todos verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/inbox.ts __tests__/inbox-lib.test.ts
git commit -m "feat: helpers do Inbox (labels de canal/status, timeAgo, formatFileSize)"
```

---

### Task 4: API `app/api/inbox/conversations/route.ts`

**Files:**
- Create: `app/api/inbox/conversations/route.ts`

- [ ] **Step 1: Implementar GET (lista + filtros) e POST (criar)**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const channel = searchParams.get('channel')
  const assignedTo = searchParams.get('assigned_to')
  const search = searchParams.get('search')

  let query = supabase
    .from('inbox_conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (channel) query = query.eq('channel', channel)
  if (assignedTo === 'me') query = query.eq('assigned_to', user.id)
  if (search) query = query.or(`contact_name.ilike.%${search}%,contact_handle.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()

  if (!body.channel || !body.contact_name) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('inbox_conversations')
    .insert({
      channel: body.channel,
      contact_name: body.contact_name,
      contact_handle: body.contact_handle ?? null,
      lead_id: body.lead_id ?? null,
      client_id: body.client_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros apontando para `app/api/inbox/conversations/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/inbox/conversations/route.ts
git commit -m "feat: API de listagem e criação de conversas do Inbox"
```

---

### Task 5: API `app/api/inbox/conversations/[id]/route.ts`

**Files:**
- Create: `app/api/inbox/conversations/[id]/route.ts`

- [ ] **Step 1: Implementar GET (detalhe) e PATCH (atualizar status/responsável/vínculos)**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if ('status' in body) update.status = body.status
  if ('assigned_to' in body) update.assigned_to = body.assigned_to
  if ('lead_id' in body) update.lead_id = body.lead_id
  if ('client_id' in body) update.client_id = body.client_id

  const { data, error } = await supabase
    .from('inbox_conversations')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros apontando para `app/api/inbox/conversations/[id]/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/inbox/conversations/[id]/route.ts"
git commit -m "feat: API de detalhe e atualização de conversa do Inbox"
```

---

### Task 6: API `app/api/inbox/conversations/[id]/messages/route.ts`

**Files:**
- Create: `app/api/inbox/conversations/[id]/messages/route.ts`

- [ ] **Step 1: Implementar GET (lista de mensagens) e POST (registrar mensagem + notificar responsável)**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('inbox_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if (!body.direction || (!body.content && !body.attachment_r2_key)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const { data: message, error } = await supabase
    .from('inbox_messages')
    .insert({
      conversation_id: id,
      direction: body.direction,
      content: body.content ?? null,
      attachment_r2_key: body.attachment_r2_key ?? null,
      attachment_name: body.attachment_name ?? null,
      attachment_mime_type: body.attachment_mime_type ?? null,
      attachment_size: body.attachment_size ?? null,
      sender_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.direction === 'inbound') {
    const { data: conversation } = await supabase
      .from('inbox_conversations')
      .select('contact_name, assigned_to')
      .eq('id', id)
      .single()

    if (conversation?.assigned_to) {
      await supabase.from('notifications').insert({
        title: `Nova mensagem de ${conversation.contact_name}`,
        body: message.content ?? '[Anexo]',
        link: `/inbox?conversation=${id}`,
      })
    }
  }

  return NextResponse.json(message, { status: 201 })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros apontando para `app/api/inbox/conversations/[id]/messages/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/inbox/conversations/[id]/messages/route.ts"
git commit -m "feat: API de mensagens do Inbox (listar, registrar, notificar responsável)"
```

---

### Task 7: API `app/api/inbox/conversations/[id]/messages/presign/route.ts`

**Files:**
- Create: `app/api/inbox/conversations/[id]/messages/presign/route.ts`

- [ ] **Step 1: Implementar POST (URL assinada de upload no R2)**

Mesmo padrão de `app/api/clients/[id]/documents/presign/route.ts`, com prefixo `inbox/{id}/` no `r2_key`:

```ts
import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { name, size, mime_type } = await request.json()

  if (!name || !size || !mime_type) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const MAX_SIZE = 500 * 1024 * 1024 // 500 MB
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 500 MB.' }, { status: 413 })
  }

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2_key = `inbox/${id}/${crypto.randomUUID()}-${safeName}`

  const upload_url = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2_key,
      ContentType: mime_type,
    }),
    { expiresIn: 3600 } // URL válida por 1h
  )

  return NextResponse.json({ upload_url, r2_key })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros apontando para `app/api/inbox/conversations/[id]/messages/presign/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/inbox/conversations/[id]/messages/presign/route.ts"
git commit -m "feat: API de presign de anexos do Inbox (upload R2)"
```

---

### Task 8: API `app/api/inbox/messages/[id]/attachment/route.ts`

**Files:**
- Create: `app/api/inbox/messages/[id]/attachment/route.ts`

- [ ] **Step 1: Implementar GET (URL assinada de download/preview)**

Mesmo padrão de `app/api/clients/[id]/documents/[docId]/route.ts` (GET), buscando o anexo em `inbox_messages`:

```ts
import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'

// Gera URL assinada para download ou preview do anexo de uma mensagem
// ?preview=true → disposition inline (para exibir no browser)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data: message, error } = await supabase
    .from('inbox_messages')
    .select('attachment_r2_key, attachment_name')
    .eq('id', id)
    .single()

  if (error || !message || !message.attachment_r2_key) {
    return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })
  }

  const isPreview = new URL(request.url).searchParams.get('preview') === 'true'
  const filename = message.attachment_name ?? 'arquivo'

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: message.attachment_r2_key,
      ResponseContentDisposition: isPreview
        ? `inline; filename="${encodeURIComponent(filename)}"`
        : `attachment; filename="${encodeURIComponent(filename)}"`,
    }),
    { expiresIn: 3600 }
  )

  return NextResponse.json({ url })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros apontando para `app/api/inbox/messages/[id]/attachment/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/inbox/messages/[id]/attachment/route.ts"
git commit -m "feat: API de download/preview de anexos do Inbox"
```

---

### Task 9: API `app/api/inbox/conversations/[id]/lead/route.ts`

**Files:**
- Create: `app/api/inbox/conversations/[id]/lead/route.ts`

- [ ] **Step 1: Implementar POST ("+ Criar Lead" a partir de conversa avulsa)**

Cria um `Lead` a partir dos dados da conversa (`name = contact_name`, `source = channel`, `phone`/`instagram` mapeados conforme o canal) e vincula `inbox_conversations.lead_id` ao novo lead:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data: conversation, error: fetchError } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !conversation) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert({
      name: conversation.contact_name,
      source: conversation.channel,
      phone: conversation.channel === 'whatsapp' ? conversation.contact_handle : null,
      instagram: conversation.channel === 'instagram' ? conversation.contact_handle : null,
    })
    .select()
    .single()

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 })

  const { data: updatedConversation, error: updateError } = await supabase
    .from('inbox_conversations')
    .update({ lead_id: lead.id })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ lead, conversation: updatedConversation }, { status: 201 })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros apontando para `app/api/inbox/conversations/[id]/lead/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/inbox/conversations/[id]/lead/route.ts"
git commit -m "feat: API de criação de Lead a partir de conversa avulsa do Inbox"
```

---

### Task 10: Navegação — item "Inbox" no Sidebar

**Files:**
- Modify: `components/layout/Sidebar.tsx`
- Test: `__tests__/sidebar.test.tsx`

- [ ] **Step 1: Escrever a asserção que falha**

Em `__tests__/sidebar.test.tsx:22`, logo após `expect(screen.getByText('Dashboard')).toBeInTheDocument()`, adicionar:

```tsx
    expect(screen.getByText('Inbox')).toBeInTheDocument()
```

O bloco `it('renderiza todos os itens de navegação', ...)` fica:

```tsx
  it('renderiza todos os itens de navegação', () => {
    render(<Sidebar />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Inbox')).toBeInTheDocument()
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.getByText('Propostas')).toBeInTheDocument()
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    expect(screen.getByText('Tarefas')).toBeInTheDocument()
    expect(screen.getByText('Serviços')).toBeInTheDocument()
    expect(screen.getByText('Automações')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/sidebar.test.tsx`
Expected: FAIL — `Unable to find an element with the text: Inbox`.

- [ ] **Step 3: Adicionar o item "Inbox" ao Sidebar**

Em `components/layout/Sidebar.tsx:7-20`, adicionar `Inbox` ao import de `lucide-react` (logo após `LayoutDashboard,`):

```ts
import {
  LayoutDashboard,
  Inbox,
  Target,
  Users,
  Users2,
  FileText,
  DollarSign,
  CheckSquare,
  Settings,
  Zap,
  LogOut,
  BarChart2,
  BookOpen,
} from 'lucide-react'
```

Em `components/layout/Sidebar.tsx:26-38`, adicionar o item logo após "Dashboard":

```ts
const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/inbox', icon: Inbox, label: 'Inbox' },
  { href: '/pipeline', icon: Target, label: 'Pipeline' },
  { href: '/clients', icon: Users, label: 'Clientes' },
  { href: '/proposals', icon: FileText, label: 'Propostas' },
  { href: '/financial', icon: DollarSign, label: 'Financeiro' },
  { href: '/reports', icon: BarChart2, label: 'Relatórios' },
  { href: '/tasks', icon: CheckSquare, label: 'Tarefas' },
  { href: '/docs', icon: BookOpen, label: 'Documentos' },
  { href: '/team', icon: Users2, label: 'Equipe' },
  { href: '/automations', icon: Zap, label: 'Automações' },
  { href: '/services', icon: Settings, label: 'Serviços' },
]
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/sidebar.test.tsx`
Expected: PASS — 2 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add components/layout/Sidebar.tsx __tests__/sidebar.test.tsx
git commit -m "feat: item Inbox na navegação lateral"
```

---

### Task 11: Lista de conversas (`components/inbox/ConversationList.tsx`)

**Files:**
- Create: `components/inbox/ConversationList.tsx`
- Test: `__tests__/conversation-list.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/conversation-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConversationList from '@/components/inbox/ConversationList'
import type { InboxConversation, Profile } from '@/lib/types'

const profiles: Profile[] = [
  {
    id: 'user-1',
    name: 'Ana Lima',
    email: 'ana@autocrm.com',
    avatar_color: '#6366f1',
    avatar_url: null,
    bio: null,
    phone: null,
    birth_date: null,
    role: 'admin',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]

const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

const conversations: InboxConversation[] = [
  {
    id: 'conv-1',
    channel: 'whatsapp',
    contact_name: 'João Silva',
    contact_handle: '+5511999999999',
    lead_id: null,
    client_id: null,
    status: 'open',
    assigned_to: 'user-1',
    last_message_at: fiveMinAgo,
    last_message_preview: 'Olá, tudo bem?',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: fiveMinAgo,
  },
  {
    id: 'conv-2',
    channel: 'instagram',
    contact_name: 'Maria Souza',
    contact_handle: '@mariasouza',
    lead_id: 'lead-1',
    client_id: null,
    status: 'resolved',
    assigned_to: null,
    last_message_at: null,
    last_message_preview: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
]

describe('ConversationList', () => {
  it('renderiza as conversas com canal, status e preview', () => {
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={vi.fn()}
      />
    )

    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('Olá, tudo bem?')).toBeInTheDocument()
    expect(screen.getByText('Aberta')).toBeInTheDocument()
    expect(screen.getByText('Resolvida')).toBeInTheDocument()
  })

  it('exibe "Sem vínculo" para conversas sem lead/cliente', () => {
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={vi.fn()}
      />
    )

    expect(screen.getByText('Sem vínculo')).toBeInTheDocument()
  })

  it('filtra por busca de contact_name', () => {
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={vi.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Buscar conversa...'), {
      target: { value: 'Maria' },
    })

    expect(screen.queryByText('João Silva')).not.toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
  })

  it('filtro "Minhas" mostra apenas conversas do usuário logado', () => {
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Minhas'))

    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument()
  })

  it('chama onSelect ao clicar em uma conversa', () => {
    const onSelect = vi.fn()
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={onSelect}
        onNewConversation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('João Silva'))

    expect(onSelect).toHaveBeenCalledWith('conv-1')
  })

  it('chama onNewConversation ao clicar em "+ Nova conversa"', () => {
    const onNewConversation = vi.fn()
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={onNewConversation}
      />
    )

    fireEvent.click(screen.getByText('+ Nova conversa'))

    expect(onNewConversation).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/conversation-list.test.tsx`
Expected: FAIL — `Cannot find module '@/components/inbox/ConversationList'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `components/inbox/ConversationList.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { ConversationStatus, InboxChannel, InboxConversation, Profile } from '@/lib/types'
import { CHANNEL_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANT, timeAgo } from '@/lib/inbox'
import ProfileAvatar, { getInitials } from '@/components/team/ProfileAvatar'
import Badge from '@/components/ui/Badge'
import { Search, MessageCircle, Camera, ThumbsUp, type LucideIcon } from 'lucide-react'

const CHANNEL_ICONS: Record<InboxChannel, LucideIcon> = {
  whatsapp: MessageCircle,
  instagram: Camera,
  facebook: ThumbsUp,
}

type StatusFilter = 'all' | 'mine' | ConversationStatus
type ChannelFilter = 'all' | InboxChannel

interface ConversationListProps {
  conversations: InboxConversation[]
  profiles: Profile[]
  currentUserId: string
  selectedId: string | null
  onSelect: (id: string) => void
  onNewConversation: () => void
}

export default function ConversationList({
  conversations,
  profiles,
  currentUserId,
  selectedId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')

  const filtered = conversations
    .filter((c) => {
      if (!search) return true
      const term = search.toLowerCase()
      return (
        c.contact_name.toLowerCase().includes(term) ||
        (c.contact_handle ?? '').toLowerCase().includes(term)
      )
    })
    .filter((c) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'mine') return c.assigned_to === currentUserId
      return c.status === statusFilter
    })
    .filter((c) => channelFilter === 'all' || c.channel === channelFilter)

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-lg font-bold">Inbox</h1>
          <button
            onClick={onNewConversation}
            className="bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            + Nova conversa
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {([
            ['all', 'Todas'],
            ['mine', 'Minhas'],
            ['open', 'Abertas'],
            ['pending', 'Pendentes'],
            ['resolved', 'Resolvidas'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                statusFilter === value
                  ? 'bg-indigo-600 text-[#050505]'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {([
            ['all', 'Todos'],
            ['whatsapp', 'WhatsApp'],
            ['instagram', 'Instagram'],
            ['facebook', 'Facebook'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setChannelFilter(value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors border ${
                channelFilter === value
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-700/50'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm px-4">
            Nenhuma conversa encontrada.
          </div>
        ) : (
          filtered.map((conv) => {
            const ChannelIcon = CHANNEL_ICONS[conv.channel]
            const assignedProfile = profiles.find((p) => p.id === conv.assigned_to)
            const isUnlinked = !conv.lead_id && !conv.client_id

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 border-b border-slate-800 text-left transition-colors ${
                  selectedId === conv.id ? 'bg-indigo-600/10' : 'hover:bg-slate-700/30'
                }`}
              >
                <div className="w-9 h-9 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 font-semibold text-sm flex-shrink-0">
                  {getInitials(conv.contact_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{conv.contact_name}</p>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <ChannelIcon size={10} />
                        {CHANNEL_LABELS[conv.channel]}
                      </span>
                    </div>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-slate-500 flex-shrink-0">{timeAgo(conv.last_message_at)}</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs truncate mt-0.5">
                    {conv.last_message_preview ?? 'Sem mensagens'}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant={STATUS_BADGE_VARIANT[conv.status]}>{STATUS_LABELS[conv.status]}</Badge>
                    {isUnlinked && (
                      <span className="text-[10px] text-slate-500">Sem vínculo</span>
                    )}
                    {assignedProfile && (
                      <ProfileAvatar name={assignedProfile.name} color={assignedProfile.avatar_color} avatarUrl={assignedProfile.avatar_url} size="sm" className="ml-auto" />
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/conversation-list.test.tsx`
Expected: PASS — 6 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add components/inbox/ConversationList.tsx __tests__/conversation-list.test.tsx
git commit -m "feat: lista de conversas do Inbox (busca, filtros, status, vínculo)"
```

---

### Task 12: Bolha de mensagem (`components/inbox/MessageBubble.tsx`)

**Files:**
- Create: `components/inbox/MessageBubble.tsx`
- Test: `__tests__/message-bubble.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/message-bubble.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MessageBubble from '@/components/inbox/MessageBubble'
import type { InboxMessage } from '@/lib/types'

function buildMessage(overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    direction: 'outbound',
    content: null,
    attachment_r2_key: null,
    attachment_name: null,
    attachment_mime_type: null,
    attachment_size: null,
    sender_id: null,
    created_at: '2026-06-11T14:30:00.000Z',
    ...overrides,
  }
}

describe('MessageBubble', () => {
  it('renderiza mensagem de texto outbound com nome do remetente', () => {
    render(
      <MessageBubble
        message={buildMessage({ content: 'Olá, como posso ajudar?' })}
        senderName="Ana Lima"
        attachmentUrl={null}
      />
    )

    expect(screen.getByText('Olá, como posso ajudar?')).toBeInTheDocument()
    expect(screen.getByText('· Ana Lima')).toBeInTheDocument()
  })

  it('renderiza mensagem de texto inbound sem nome do remetente', () => {
    render(
      <MessageBubble
        message={buildMessage({ direction: 'inbound', content: 'Quero saber mais' })}
        senderName={null}
        attachmentUrl={null}
      />
    )

    expect(screen.getByText('Quero saber mais')).toBeInTheDocument()
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })

  it('exibe o horário formatado da mensagem', () => {
    const createdAt = '2026-06-11T14:30:00.000Z'
    const expectedTime = new Date(createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    render(
      <MessageBubble
        message={buildMessage({ content: 'Oi', created_at: createdAt })}
        senderName={null}
        attachmentUrl={null}
      />
    )

    expect(screen.getByText(expectedTime)).toBeInTheDocument()
  })

  it('renderiza imagem como thumbnail clicável e abre lightbox', () => {
    render(
      <MessageBubble
        message={buildMessage({
          attachment_r2_key: 'inbox/conv-1/foto.png',
          attachment_name: 'foto.png',
          attachment_mime_type: 'image/png',
          attachment_size: 1024,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/foto.png"
      />
    )

    const thumbnail = screen.getByAltText('foto.png')
    expect(thumbnail).toHaveAttribute('src', 'https://r2.example.com/foto.png')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(thumbnail)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renderiza vídeo com player inline', () => {
    const { container } = render(
      <MessageBubble
        message={buildMessage({
          attachment_r2_key: 'inbox/conv-1/video.mp4',
          attachment_name: 'video.mp4',
          attachment_mime_type: 'video/mp4',
          attachment_size: 2048,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/video.mp4"
      />
    )

    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', 'https://r2.example.com/video.mp4')
  })

  it('renderiza áudio com player inline', () => {
    const { container } = render(
      <MessageBubble
        message={buildMessage({
          attachment_r2_key: 'inbox/conv-1/audio.mp3',
          attachment_name: 'audio.mp3',
          attachment_mime_type: 'audio/mpeg',
          attachment_size: 4096,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/audio.mp3"
      />
    )

    const audio = container.querySelector('audio')
    expect(audio).toHaveAttribute('src', 'https://r2.example.com/audio.mp3')
  })

  it('renderiza anexo genérico com nome, tamanho e link de download', () => {
    render(
      <MessageBubble
        message={buildMessage({
          attachment_r2_key: 'inbox/conv-1/contrato.pdf',
          attachment_name: 'contrato.pdf',
          attachment_mime_type: 'application/pdf',
          attachment_size: 204800,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/contrato.pdf"
      />
    )

    expect(screen.getByText('contrato.pdf')).toBeInTheDocument()
    expect(screen.getByText('200.0 KB')).toBeInTheDocument()

    const link = screen.getByRole('link', { name: 'Baixar anexo' })
    expect(link).toHaveAttribute('href', 'https://r2.example.com/contrato.pdf')
  })

  it('renderiza content junto com anexo quando ambos presentes', () => {
    render(
      <MessageBubble
        message={buildMessage({
          content: 'Segue o contrato',
          attachment_r2_key: 'inbox/conv-1/contrato.pdf',
          attachment_name: 'contrato.pdf',
          attachment_mime_type: 'application/pdf',
          attachment_size: 204800,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/contrato.pdf"
      />
    )

    expect(screen.getByText('Segue o contrato')).toBeInTheDocument()
    expect(screen.getByText('contrato.pdf')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/message-bubble.test.tsx`
Expected: FAIL — `Cannot find module '@/components/inbox/MessageBubble'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `components/inbox/MessageBubble.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { InboxMessage } from '@/lib/types'
import { formatFileSize } from '@/lib/inbox'
import { File, Download, X } from 'lucide-react'

interface MessageBubbleProps {
  message: InboxMessage
  senderName: string | null
  attachmentUrl: string | null
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, senderName, attachmentUrl }: MessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const isOutbound = message.direction === 'outbound'
  const mime = message.attachment_mime_type ?? ''
  const isImage = mime.startsWith('image/')
  const isVideo = mime.startsWith('video/')
  const isAudio = mime.startsWith('audio/')
  const isGenericFile = message.attachment_r2_key !== null && !isImage && !isVideo && !isAudio

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isOutbound
            ? 'bg-indigo-600 text-[#050505]'
            : 'bg-[#1a1a1d] text-white border border-slate-700'
        }`}
      >
        {message.attachment_r2_key && (
          <div className="mb-1.5">
            {isImage && attachmentUrl && (
              <>
                <img
                  src={attachmentUrl}
                  alt={message.attachment_name ?? 'Anexo'}
                  onClick={() => setLightboxOpen(true)}
                  className="max-w-full max-h-60 rounded cursor-pointer"
                />
                {lightboxOpen && (
                  <div
                    role="dialog"
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
                    onClick={() => setLightboxOpen(false)}
                  >
                    <img
                      src={attachmentUrl}
                      alt={message.attachment_name ?? 'Anexo'}
                      className="max-w-[90vw] max-h-[90vh]"
                    />
                    <button
                      onClick={() => setLightboxOpen(false)}
                      aria-label="Fechar"
                      className="absolute top-4 right-4 text-white"
                    >
                      <X size={24} />
                    </button>
                  </div>
                )}
              </>
            )}

            {isVideo && attachmentUrl && (
              <video src={attachmentUrl} controls className="max-w-full max-h-60 rounded" />
            )}

            {isAudio && attachmentUrl && (
              <audio src={attachmentUrl} controls className="max-w-full" />
            )}

            {isGenericFile && (
              <div className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
                <File size={16} className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{message.attachment_name}</p>
                  {message.attachment_size !== null && (
                    <p className="text-[10px] opacity-70">{formatFileSize(message.attachment_size)}</p>
                  )}
                </div>
                {attachmentUrl && (
                  <a
                    href={attachmentUrl}
                    download={message.attachment_name ?? undefined}
                    aria-label="Baixar anexo"
                    className="flex-shrink-0"
                  >
                    <Download size={16} />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}

        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] opacity-60">{formatTime(message.created_at)}</span>
          {isOutbound && senderName && <span className="text-[10px] opacity-60">· {senderName}</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/message-bubble.test.tsx`
Expected: PASS — 8 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add components/inbox/MessageBubble.tsx __tests__/message-bubble.test.tsx
git commit -m "feat: bolha de mensagem do Inbox (texto, imagem/lightbox, video, audio, anexo generico)"
```

---

### Task 13: Thread da conversa (`components/inbox/ConversationThread.tsx`)

**Files:**
- Create: `components/inbox/ConversationThread.tsx`
- Test: `__tests__/conversation-thread.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/conversation-thread.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import ConversationThread from '@/components/inbox/ConversationThread'
import type { InboxConversation, InboxMessage, Profile } from '@/lib/types'

const conversation: InboxConversation = {
  id: 'conv-1',
  channel: 'whatsapp',
  contact_name: 'João Silva',
  contact_handle: '+5511999999999',
  lead_id: null,
  client_id: null,
  status: 'open',
  assigned_to: null,
  last_message_at: '2026-06-11T14:00:00.000Z',
  last_message_preview: 'Oi',
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-11T14:00:00.000Z',
}

const profiles: Profile[] = [
  {
    id: 'user-1',
    name: 'Ana Lima',
    email: 'ana@autocrm.com',
    avatar_color: '#6366f1',
    avatar_url: null,
    bio: null,
    phone: null,
    birth_date: null,
    role: 'admin',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-2',
    name: 'Bruno Costa',
    email: 'bruno@autocrm.com',
    avatar_color: '#f59e0b',
    avatar_url: null,
    bio: null,
    phone: null,
    birth_date: null,
    role: 'member',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]

const messages: InboxMessage[] = [
  {
    id: 'msg-1',
    conversation_id: 'conv-1',
    direction: 'inbound',
    content: 'Olá, quero saber mais',
    attachment_r2_key: null,
    attachment_name: null,
    attachment_mime_type: null,
    attachment_size: null,
    sender_id: null,
    created_at: '2026-06-11T13:00:00.000Z',
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-1',
    direction: 'outbound',
    content: 'Claro! Como posso ajudar?',
    attachment_r2_key: null,
    attachment_name: null,
    attachment_mime_type: null,
    attachment_size: null,
    sender_id: 'user-1',
    created_at: '2026-06-11T13:05:00.000Z',
  },
]

function buildProps(
  overrides: Partial<ComponentProps<typeof ConversationThread>> = {}
): ComponentProps<typeof ConversationThread> {
  return {
    conversation,
    messages,
    profiles,
    attachmentUrls: {},
    linkedEntity: null,
    onSendMessage: vi.fn(),
    onUpdateStatus: vi.fn(),
    onUpdateAssignee: vi.fn(),
    onLinkClick: vi.fn(),
    onCreateLead: vi.fn(),
    ...overrides,
  }
}

describe('ConversationThread', () => {
  it('renderiza o nome do contato e o badge do canal', () => {
    render(<ConversationThread {...buildProps()} />)

    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
  })

  it('exibe chip de vínculo com Lead quando vinculada', () => {
    render(
      <ConversationThread
        {...buildProps({ linkedEntity: { type: 'lead', id: 'lead-1', name: 'João Silva' } })}
      />
    )

    const chip = screen.getByRole('link', { name: '→ Lead: João Silva' })
    expect(chip).toHaveAttribute('href', '/pipeline')
  })

  it('exibe botões de vínculo e criar lead quando não vinculada', () => {
    const onLinkClick = vi.fn()
    const onCreateLead = vi.fn()
    render(<ConversationThread {...buildProps({ onLinkClick, onCreateLead })} />)

    fireEvent.click(screen.getByText('Vincular a Lead/Cliente'))
    expect(onLinkClick).toHaveBeenCalled()

    fireEvent.click(screen.getByText('+ Criar Lead'))
    expect(onCreateLead).toHaveBeenCalled()
  })

  it('chama onUpdateStatus ao alterar o dropdown de status', () => {
    const onUpdateStatus = vi.fn()
    render(<ConversationThread {...buildProps({ onUpdateStatus })} />)

    fireEvent.change(screen.getByDisplayValue('Aberta'), { target: { value: 'resolved' } })

    expect(onUpdateStatus).toHaveBeenCalledWith('resolved')
  })

  it('chama onUpdateAssignee ao alterar o dropdown de responsável', () => {
    const onUpdateAssignee = vi.fn()
    render(<ConversationThread {...buildProps({ onUpdateAssignee })} />)

    fireEvent.change(screen.getByDisplayValue('Sem responsável'), { target: { value: 'user-2' } })

    expect(onUpdateAssignee).toHaveBeenCalledWith('user-2')
  })

  it('renderiza as mensagens da conversa', () => {
    render(<ConversationThread {...buildProps()} />)

    expect(screen.getByText('Olá, quero saber mais')).toBeInTheDocument()
    expect(screen.getByText('Claro! Como posso ajudar?')).toBeInTheDocument()
    expect(screen.getByText('· Ana Lima')).toBeInTheDocument()
  })

  it('composer: registra mensagem com direção "Mensagem do contato" quando selecionada', () => {
    const onSendMessage = vi.fn()
    render(<ConversationThread {...buildProps({ onSendMessage })} />)

    fireEvent.click(screen.getByText('Mensagem do contato'))
    fireEvent.change(screen.getByPlaceholderText('Digite a mensagem...'), {
      target: { value: 'Recebi um pedido' },
    })
    fireEvent.click(screen.getByText('Registrar'))

    expect(onSendMessage).toHaveBeenCalledWith({
      direction: 'inbound',
      content: 'Recebi um pedido',
      file: null,
    })
  })

  it('composer: registra mensagem outbound por padrão e limpa o campo', () => {
    const onSendMessage = vi.fn()
    render(<ConversationThread {...buildProps({ onSendMessage })} />)

    const textarea = screen.getByPlaceholderText('Digite a mensagem...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Resposta da equipe' } })
    fireEvent.click(screen.getByText('Registrar'))

    expect(onSendMessage).toHaveBeenCalledWith({
      direction: 'outbound',
      content: 'Resposta da equipe',
      file: null,
    })
    expect(textarea.value).toBe('')
  })

  it('composer: exibe erro ao registrar sem conteúdo nem anexo', () => {
    const onSendMessage = vi.fn()
    render(<ConversationThread {...buildProps({ onSendMessage })} />)

    fireEvent.click(screen.getByText('Registrar'))

    expect(screen.getByText('Digite uma mensagem ou anexe um arquivo.')).toBeInTheDocument()
    expect(onSendMessage).not.toHaveBeenCalled()
  })

  it('composer: anexa um arquivo e exibe o nome', () => {
    render(<ConversationThread {...buildProps()} />)

    const file = new File(['conteudo'], 'foto.png', { type: 'image/png' })
    const input = screen.getByLabelText('Anexar arquivo')
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText('foto.png')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/conversation-thread.test.tsx`
Expected: FAIL — `Cannot find module '@/components/inbox/ConversationThread'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `components/inbox/ConversationThread.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type {
  ConversationStatus,
  InboxChannel,
  InboxConversation,
  InboxMessage,
  MessageDirection,
  Profile,
} from '@/lib/types'
import { CHANNEL_LABELS, STATUS_LABELS } from '@/lib/inbox'
import MessageBubble from './MessageBubble'
import { getInitials } from '@/components/team/ProfileAvatar'
import { Paperclip, Send, X, MessageCircle, Camera, ThumbsUp, type LucideIcon } from 'lucide-react'

const CHANNEL_ICONS: Record<InboxChannel, LucideIcon> = {
  whatsapp: MessageCircle,
  instagram: Camera,
  facebook: ThumbsUp,
}

export interface SendMessageData {
  direction: MessageDirection
  content: string | null
  file: File | null
}

export interface LinkedEntity {
  type: 'lead' | 'client'
  id: string
  name: string
}

interface ConversationThreadProps {
  conversation: InboxConversation
  messages: InboxMessage[]
  profiles: Profile[]
  attachmentUrls: Record<string, string>
  linkedEntity: LinkedEntity | null
  onSendMessage: (data: SendMessageData) => void
  onUpdateStatus: (status: ConversationStatus) => void
  onUpdateAssignee: (assignedTo: string | null) => void
  onLinkClick: () => void
  onCreateLead: () => void
}

export default function ConversationThread({
  conversation,
  messages,
  profiles,
  attachmentUrls,
  linkedEntity,
  onSendMessage,
  onUpdateStatus,
  onUpdateAssignee,
  onLinkClick,
  onCreateLead,
}: ConversationThreadProps) {
  const [direction, setDirection] = useState<MessageDirection>('outbound')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  const ChannelIcon = CHANNEL_ICONS[conversation.channel]

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  function handleSend() {
    const trimmed = content.trim()
    if (!trimmed && !file) {
      setError('Digite uma mensagem ou anexe um arquivo.')
      return
    }
    onSendMessage({ direction, content: trimmed || null, file })
    setContent('')
    setFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 font-semibold text-sm flex-shrink-0">
            {getInitials(conversation.contact_name)}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{conversation.contact_name}</p>
            <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full w-fit">
              <ChannelIcon size={10} />
              {CHANNEL_LABELS[conversation.channel]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {linkedEntity ? (
            <Link
              href={linkedEntity.type === 'lead' ? '/pipeline' : `/clients/${linkedEntity.id}`}
              className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-600/10 border border-indigo-700/50 rounded-full px-3 py-1"
            >
              → {linkedEntity.type === 'lead' ? 'Lead' : 'Cliente'}: {linkedEntity.name}
            </Link>
          ) : (
            <>
              <button
                onClick={onLinkClick}
                className="text-xs text-slate-300 border border-slate-700 rounded-full px-3 py-1 hover:border-slate-600"
              >
                Vincular a Lead/Cliente
              </button>
              <button
                onClick={onCreateLead}
                className="text-xs text-indigo-400 border border-indigo-700/50 bg-indigo-600/10 rounded-full px-3 py-1 hover:bg-indigo-600/20"
              >
                + Criar Lead
              </button>
            </>
          )}

          <select
            value={conversation.status}
            onChange={(e) => onUpdateStatus(e.target.value as ConversationStatus)}
            className="bg-[#050505] border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="open">{STATUS_LABELS.open}</option>
            <option value="pending">{STATUS_LABELS.pending}</option>
            <option value="resolved">{STATUS_LABELS.resolved}</option>
          </select>

          <select
            value={conversation.assigned_to ?? ''}
            onChange={(e) => onUpdateAssignee(e.target.value || null)}
            className="bg-[#050505] border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">Nenhuma mensagem ainda.</div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              senderName={profiles.find((p) => p.id === msg.sender_id)?.name ?? null}
              attachmentUrl={attachmentUrls[msg.id] ?? null}
            />
          ))
        )}
      </div>

      <div className="border-t border-slate-700 p-3 space-y-2">
        <div className="flex gap-1.5">
          <button
            onClick={() => setDirection('inbound')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              direction === 'inbound'
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Mensagem do contato
          </button>
          <button
            onClick={() => setDirection('outbound')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              direction === 'outbound'
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Minha resposta
          </button>
        </div>

        {file && (
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 w-fit">
            {file.name}
            <button
              onClick={() => setFile(null)}
              aria-label="Remover anexo"
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite a mensagem..."
            rows={2}
            className="flex-1 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
          />
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            aria-label="Anexar arquivo"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Selecionar anexo"
            className="text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg p-2"
          >
            <Paperclip size={16} />
          </button>
          <button
            onClick={handleSend}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Send size={14} />
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/conversation-thread.test.tsx`
Expected: PASS — 10 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add components/inbox/ConversationThread.tsx __tests__/conversation-thread.test.tsx
git commit -m "feat: thread de conversa do Inbox (header, mensagens, composer)"
```

---

### Task 14: Modal "+ Nova conversa" (`components/inbox/NewConversationModal.tsx`)

**Files:**
- Create: `components/inbox/NewConversationModal.tsx`

- [ ] **Step 1: Implementar `components/inbox/NewConversationModal.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Client, InboxChannel, InboxConversation, Lead } from '@/lib/types'
import { CHANNEL_LABELS } from '@/lib/inbox'

interface NewConversationModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  leads: Lead[]
  onCreated: (conversation: InboxConversation) => void
}

type LinkMode = 'existing' | 'standalone'

export default function NewConversationModal({
  isOpen,
  onClose,
  clients,
  leads,
  onCreated,
}: NewConversationModalProps) {
  const [channel, setChannel] = useState<InboxChannel>('whatsapp')
  const [linkMode, setLinkMode] = useState<LinkMode>('standalone')
  const [selectedSource, setSelectedSource] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactHandle, setContactHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setChannel('whatsapp')
    setLinkMode('standalone')
    setSelectedSource('')
    setContactName('')
    setContactHandle('')
    setError(null)
    setLoading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function applySource(value: string, ch: InboxChannel) {
    const [type, id] = value.split(':')
    const source = type === 'client' ? clients.find((c) => c.id === id) : leads.find((l) => l.id === id)
    if (!source) return
    setContactName(source.name)
    if (ch === 'whatsapp') setContactHandle(source.phone ?? '')
    else if (ch === 'instagram') setContactHandle(source.instagram ?? '')
    else setContactHandle('')
  }

  function handleChannelChange(next: InboxChannel) {
    setChannel(next)
    if (linkMode === 'existing' && selectedSource) {
      applySource(selectedSource, next)
    }
  }

  function handleSourceChange(value: string) {
    setSelectedSource(value)
    if (!value) {
      setContactName('')
      setContactHandle('')
      return
    }
    applySource(value, channel)
  }

  function handleLinkModeChange(mode: LinkMode) {
    setLinkMode(mode)
    setSelectedSource('')
    setContactName('')
    setContactHandle('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactName.trim()) {
      setError('Informe o nome do contato.')
      return
    }

    setLoading(true)
    setError(null)

    const [type, id] =
      linkMode === 'existing' && selectedSource ? selectedSource.split(':') : [null, null]

    const res = await fetch('/api/inbox/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        contact_name: contactName.trim(),
        contact_handle: contactHandle.trim() || null,
        lead_id: type === 'lead' ? id : null,
        client_id: type === 'client' ? id : null,
      }),
    })

    if (!res.ok) {
      setError('Erro ao criar conversa. Tente novamente.')
      setLoading(false)
      return
    }

    const conversation = await res.json()
    onCreated(conversation)
    reset()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nova conversa">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Canal</label>
          <div className="flex gap-1.5">
            {(['whatsapp', 'instagram', 'facebook'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => handleChannelChange(ch)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  channel === ch
                    ? 'bg-indigo-600 text-[#050505]'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {CHANNEL_LABELS[ch]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => handleLinkModeChange('existing')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              linkMode === 'existing'
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Vincular a Lead/Cliente
          </button>
          <button
            type="button"
            onClick={() => handleLinkModeChange('standalone')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              linkMode === 'standalone'
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Contato avulso
          </button>
        </div>

        {linkMode === 'existing' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Cliente ou lead</label>
            <select
              value={selectedSource}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Selecione...</option>
              {clients.length > 0 && (
                <optgroup label="Clientes">
                  {clients.map((c) => (
                    <option key={`client:${c.id}`} value={`client:${c.id}`}>
                      {c.name} {c.company ? `— ${c.company}` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {leads.length > 0 && (
                <optgroup label="Leads">
                  {leads.map((l) => (
                    <option key={`lead:${l.id}`} value={`lead:${l.id}`}>
                      {l.name} {l.company ? `— ${l.company}` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nome do contato *</label>
          <input
            type="text"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome do contato"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            {channel === 'whatsapp' ? 'Telefone' : 'Usuário / @handle'}
          </label>
          <input
            type="text"
            value={contactHandle}
            onChange={(e) => setContactHandle(e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder={channel === 'whatsapp' ? '+5511999999999' : '@usuario'}
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Criando...' : 'Criar conversa'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `components/inbox/NewConversationModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/inbox/NewConversationModal.tsx
git commit -m "feat: modal de nova conversa do Inbox (canal, vinculo, contato avulso)"
```

---

### Task 15: Modal "Vincular a Lead/Cliente" (`components/inbox/LinkLeadModal.tsx`)

**Files:**
- Create: `components/inbox/LinkLeadModal.tsx`

- [ ] **Step 1: Implementar `components/inbox/LinkLeadModal.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Client, Lead } from '@/lib/types'

export interface LinkSelection {
  type: 'lead' | 'client'
  id: string
}

interface LinkLeadModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  leads: Lead[]
  onLink: (selection: LinkSelection) => void
}

export default function LinkLeadModal({ isOpen, onClose, clients, leads, onLink }: LinkLeadModalProps) {
  const [selected, setSelected] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setSelected('')
    setError(null)
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selected) {
      setError('Selecione um cliente ou lead.')
      return
    }

    const [type, id] = selected.split(':')
    onLink({ type: type as 'lead' | 'client', id })
    setSelected('')
    setError(null)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Vincular a Lead/Cliente">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Cliente ou lead</label>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value)
              setError(null)
            }}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Selecione...</option>
            {clients.length > 0 && (
              <optgroup label="Clientes">
                {clients.map((c) => (
                  <option key={`client:${c.id}`} value={`client:${c.id}`}>
                    {c.name} {c.company ? `— ${c.company}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {leads.length > 0 && (
              <optgroup label="Leads">
                {leads.map((l) => (
                  <option key={`lead:${l.id}`} value={`lead:${l.id}`}>
                    {l.name} {l.company ? `— ${l.company}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Vincular
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `components/inbox/LinkLeadModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/inbox/LinkLeadModal.tsx
git commit -m "feat: modal de vinculo a lead/cliente no Inbox"
```

---

### Task 16: Orquestrador (`components/inbox/InboxClient.tsx`)

**Files:**
- Create: `components/inbox/InboxClient.tsx`

- [ ] **Step 1: Implementar `components/inbox/InboxClient.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import type {
  Client,
  ConversationStatus,
  InboxConversation,
  InboxMessage,
  Lead,
  Profile,
} from '@/lib/types'
import ConversationList from './ConversationList'
import ConversationThread, { type LinkedEntity, type SendMessageData } from './ConversationThread'
import NewConversationModal from './NewConversationModal'
import LinkLeadModal, { type LinkSelection } from './LinkLeadModal'
import { useToast } from '@/components/ui/ToastProvider'
import EmptyState from '@/components/ui/EmptyState'

interface InboxClientProps {
  initialConversations: InboxConversation[]
  profiles: Profile[]
  initialClients: Client[]
  initialLeads: Lead[]
  currentUserId: string
  initialSelectedId: string | null
}

export default function InboxClient({
  initialConversations,
  profiles,
  initialClients,
  initialLeads,
  currentUserId,
  initialSelectedId,
}: InboxClientProps) {
  const { toast } = useToast()
  const [conversations, setConversations] = useState<InboxConversation[]>(initialConversations)
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null

  // Polling: lista de conversas a cada 15s
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/inbox/conversations')
      if (res.ok) setConversations(await res.json())
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  // Polling: mensagens da conversa aberta a cada 5s
  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    let cancelled = false

    async function load() {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/messages`)
      if (res.ok && !cancelled) setMessages(await res.json())
    }

    load()
    const interval = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [selectedId])

  // Resolve URLs assinadas para anexos ainda não carregados
  useEffect(() => {
    const pending = messages.filter((m) => m.attachment_r2_key && !attachmentUrls[m.id])
    if (pending.length === 0) return

    let cancelled = false

    async function loadUrls() {
      const entries = await Promise.all(
        pending.map(async (m) => {
          const res = await fetch(`/api/inbox/messages/${m.id}/attachment?preview=true`)
          if (!res.ok) return null
          const data = await res.json()
          return [m.id, data.url] as const
        })
      )

      if (cancelled) return

      setAttachmentUrls((prev) => {
        const next = { ...prev }
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1]
        }
        return next
      })
    }

    loadUrls()

    return () => {
      cancelled = true
    }
  }, [messages, attachmentUrls])

  function getLinkedEntity(conversation: InboxConversation): LinkedEntity | null {
    if (conversation.lead_id) {
      const lead = leads.find((l) => l.id === conversation.lead_id)
      return lead ? { type: 'lead', id: lead.id, name: lead.name } : null
    }
    if (conversation.client_id) {
      const client = clients.find((c) => c.id === conversation.client_id)
      return client ? { type: 'client', id: client.id, name: client.name } : null
    }
    return null
  }

  async function handleSendMessage(data: SendMessageData) {
    if (!selectedId) return

    let attachment: { r2_key: string; name: string; mime_type: string; size: number } | null = null

    if (data.file) {
      const presignRes = await fetch(`/api/inbox/conversations/${selectedId}/messages/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.file.name,
          size: data.file.size,
          mime_type: data.file.type,
        }),
      })

      if (!presignRes.ok) {
        toast('Erro ao preparar envio do anexo.', 'error')
        return
      }

      const { upload_url, r2_key } = await presignRes.json()

      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': data.file.type },
        body: data.file,
      })

      if (!uploadRes.ok) {
        toast('Erro ao enviar anexo.', 'error')
        return
      }

      attachment = { r2_key, name: data.file.name, mime_type: data.file.type, size: data.file.size }
    }

    const res = await fetch(`/api/inbox/conversations/${selectedId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: data.direction,
        content: data.content,
        attachment_r2_key: attachment?.r2_key ?? null,
        attachment_name: attachment?.name ?? null,
        attachment_mime_type: attachment?.mime_type ?? null,
        attachment_size: attachment?.size ?? null,
      }),
    })

    if (!res.ok) {
      toast('Erro ao registrar mensagem.', 'error')
      return
    }

    const message: InboxMessage = await res.json()
    setMessages((prev) => [...prev, message])
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              last_message_at: message.created_at,
              last_message_preview: message.content ?? '[Anexo]',
            }
          : c
      )
    )
  }

  async function handleUpdateStatus(status: ConversationStatus) {
    if (!selectedId) return
    const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      toast('Erro ao atualizar status.', 'error')
      return
    }
    const updated: InboxConversation = await res.json()
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  async function handleUpdateAssignee(assignedTo: string | null) {
    if (!selectedId) return
    const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: assignedTo }),
    })
    if (!res.ok) {
      toast('Erro ao atualizar responsável.', 'error')
      return
    }
    const updated: InboxConversation = await res.json()
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  async function handleLink(selection: LinkSelection) {
    if (!selectedId) return
    const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        selection.type === 'lead' ? { lead_id: selection.id } : { client_id: selection.id }
      ),
    })
    if (!res.ok) {
      toast('Erro ao vincular conversa.', 'error')
      return
    }
    const updated: InboxConversation = await res.json()
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setIsLinkModalOpen(false)
    toast('Conversa vinculada com sucesso.')
  }

  async function handleCreateLead() {
    if (!selectedId) return
    const res = await fetch(`/api/inbox/conversations/${selectedId}/lead`, { method: 'POST' })
    if (!res.ok) {
      toast('Erro ao criar lead.', 'error')
      return
    }
    const { lead, conversation }: { lead: Lead; conversation: InboxConversation } = await res.json()
    setLeads((prev) => [...prev, lead])
    setConversations((prev) => prev.map((c) => (c.id === conversation.id ? conversation : c)))
    toast('Lead criado e vinculado à conversa.')
  }

  function handleCreated(conversation: InboxConversation) {
    setConversations((prev) => [conversation, ...prev])
    setSelectedId(conversation.id)
    setIsNewModalOpen(false)
  }

  return (
    <div className="flex h-full">
      <div className="w-[340px] border-r border-slate-700 flex-shrink-0">
        <ConversationList
          conversations={conversations}
          profiles={profiles}
          currentUserId={currentUserId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewConversation={() => setIsNewModalOpen(true)}
        />
      </div>

      <div className="flex-1 min-w-0">
        {selectedConversation ? (
          <ConversationThread
            conversation={selectedConversation}
            messages={messages}
            profiles={profiles}
            attachmentUrls={attachmentUrls}
            linkedEntity={getLinkedEntity(selectedConversation)}
            onSendMessage={handleSendMessage}
            onUpdateStatus={handleUpdateStatus}
            onUpdateAssignee={handleUpdateAssignee}
            onLinkClick={() => setIsLinkModalOpen(true)}
            onCreateLead={handleCreateLead}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon="💬"
              title="Selecione uma conversa"
              description="Escolha uma conversa na lista ao lado ou inicie uma nova."
              action={{ label: '+ Nova conversa', onClick: () => setIsNewModalOpen(true) }}
            />
          </div>
        )}
      </div>

      <NewConversationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        clients={clients}
        leads={leads}
        onCreated={handleCreated}
      />

      <LinkLeadModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        clients={clients}
        leads={leads}
        onLink={handleLink}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros apontando para `components/inbox/InboxClient.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/inbox/InboxClient.tsx
git commit -m "feat: orquestrador do Inbox (polling, anexos, acoes da thread)"
```

---

### Task 17: Página `/inbox`

**Files:**
- Create: `app/(dashboard)/inbox/page.tsx`

- [ ] **Step 1: Criar a página**

Server Component que busca conversas, perfis, clientes e leads, e renderiza o `InboxClient`. Segue o padrão de `app/(dashboard)/proposals/page.tsx` (`Promise.all` + selects parciais com cast `as Tipo[]`) e de `app/(dashboard)/docs/[id]/page.tsx` (`if (!user) redirect('/login')`). O `searchParams` segue o padrão de `app/(dashboard)/clients/[id]/page.tsx` (`Promise<{...}>`).

O container raiz usa `h-[calc(100vh-4rem)] -m-8`: o layout (`app/(dashboard)/layout.tsx`) envolve `{children}` num `<main className="flex-1 ml-52 p-8">`, então `-m-8` cancela o padding de 2rem em cada lado e `h-[calc(100vh-4rem)]` (100vh menos os 2rem de padding superior + 2rem inferior = 4rem) faz o container ocupar exatamente a altura da viewport — necessário para o layout de 2 colunas com scroll independente do `InboxClient`.

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InboxClient from '@/components/inbox/InboxClient'
import type { Client, InboxConversation, Lead, Profile } from '@/lib/types'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>
}) {
  const { conversation } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [conversationsRes, profilesRes, clientsRes, leadsRes] = await Promise.all([
    supabase
      .from('inbox_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('name'),
    supabase
      .from('clients')
      .select('id, name, company, phone, instagram')
      .eq('status', 'active')
      .order('name'),
    supabase.from('leads').select('id, name, company, phone, instagram').order('name'),
  ])

  return (
    <div className="h-[calc(100vh-4rem)] -m-8">
      <InboxClient
        initialConversations={(conversationsRes.data as InboxConversation[]) ?? []}
        profiles={(profilesRes.data as Profile[]) ?? []}
        initialClients={(clientsRes.data as Client[]) ?? []}
        initialLeads={(leadsRes.data as Lead[]) ?? []}
        currentUserId={user.id}
        initialSelectedId={conversation ?? null}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem novos erros apontando para `app/(dashboard)/inbox/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/inbox/page.tsx"
git commit -m "feat: pagina /inbox (server component)"
```

---

### Task 18: Verificação final

**Files:**
- (nenhum arquivo novo — apenas validação de toda a feature)

- [ ] **Step 1: Rodar a suíte de testes**

Run: `npm run test:run`
Expected: todos os testes passam, incluindo os novos: `__tests__/inbox-lib.test.ts`, `__tests__/sidebar.test.tsx`, `__tests__/conversation-list.test.tsx`, `__tests__/message-bubble.test.tsx`, `__tests__/conversation-thread.test.tsx`.

- [ ] **Step 2: Checar tipos do projeto inteiro**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar o lint**

Run: `npm run lint`
Expected: sem erros (warnings de `@next/next/no-img-element` em `MessageBubble.tsx` são esperados e não falham o comando, igual ao padrão já existente em `DocumentsTab.tsx`).

- [ ] **Step 4: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros, incluindo a rota `/inbox` na lista de páginas geradas.

- [ ] **Step 5: Commit final (se houver mudanças pendentes)**

Se os comandos acima geraram alguma alteração (ex.: lockfile), commitar:

```bash
git status
```

Se `git status` não mostrar mudanças, este passo não gera commit — a feature já está totalmente commitada pelas Tasks 1-17.

---

## Resumo das Tasks

| Task | Arquivo principal | Tipo |
|---|---|---|
| 1 | `supabase/migrations/019_inbox.sql` | SQL (sem teste) |
| 2 | `lib/types.ts` | Tipos (sem teste, `tsc`) |
| 3 | `lib/inbox.ts` | TDD |
| 4 | `app/api/inbox/conversations/route.ts` | API (sem teste, `tsc`) |
| 5 | `app/api/inbox/conversations/[id]/route.ts` | API (sem teste, `tsc`) |
| 6 | `app/api/inbox/conversations/[id]/messages/route.ts` | API (sem teste, `tsc`) |
| 7 | `app/api/inbox/conversations/[id]/messages/presign/route.ts` | API (sem teste, `tsc`) |
| 8 | `app/api/inbox/messages/[id]/attachment/route.ts` | API (sem teste, `tsc`) |
| 9 | `app/api/inbox/conversations/[id]/lead/route.ts` | API (sem teste, `tsc`) |
| 10 | `components/layout/Sidebar.tsx` | TDD |
| 11 | `components/inbox/ConversationList.tsx` | TDD |
| 12 | `components/inbox/MessageBubble.tsx` | TDD |
| 13 | `components/inbox/ConversationThread.tsx` | TDD |
| 14 | `components/inbox/NewConversationModal.tsx` | UI (sem teste, `tsc`) |
| 15 | `components/inbox/LinkLeadModal.tsx` | UI (sem teste, `tsc`) |
| 16 | `components/inbox/InboxClient.tsx` | UI (sem teste, `tsc`) |
| 17 | `app/(dashboard)/inbox/page.tsx` | Server Component (sem teste, `tsc`) |
| 18 | — | Verificação final |
