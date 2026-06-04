# Pacote 6 — Motor de Automações: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de automações pré-configuradas no AutoCRM: 7 workflows (4 event-based + 3 time-based) com toggles, parâmetros configuráveis, notificações in-app e integração nas rotas existentes.

**Architecture:** Tabelas `automation_configs` (configuração por workflow) + `notifications` no Supabase. Engine central `lib/automation-engine.ts` chamada pelas rotas de API existentes quando eventos ocorrem. Automações time-based via endpoint POST. UI em `/automations` com `AutomationCard` por workflow e sininho 🔔 no sidebar.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase (MCP tools para migration)

> **Nota:** Sem suite de testes. Padrão: Implementar → Verificar no browser → Commit. Tasks devem ser executadas **em ordem** (1→9).

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| Supabase DB | Migration — `automation_configs` + `notifications` |
| `lib/types.ts` | Modificar — adicionar tipos |
| `lib/automations.ts` | Criar — definições estáticas das 7 automações |
| `lib/automation-engine.ts` | Criar — engine de execução |
| `app/api/automations/route.ts` | Criar — GET (lista + seed) |
| `app/api/automations/[key]/route.ts` | Criar — PUT (salvar config) |
| `app/api/automations/run-scheduled/route.ts` | Criar — POST (time-based) |
| `app/api/notifications/route.ts` | Criar — GET + DELETE |
| `app/api/notifications/[id]/route.ts` | Criar — PATCH |
| `app/api/leads/[id]/route.ts` | Modificar — wiring lead_won + lead_lost |
| `app/api/proposals/[id]/route.ts` | Modificar — wiring proposal_approved |
| `app/api/clients/[id]/route.ts` | Modificar — wiring client_churned |
| `components/automations/AutomationCard.tsx` | Criar — card com toggle + form |
| `components/automations/NotificationBell.tsx` | Criar — sininho com dropdown |
| `app/(dashboard)/automations/page.tsx` | Criar — página /automations |
| `components/layout/Sidebar.tsx` | Modificar — adicionar item Automações |

---

### Task 1: DB Migration

**Files:** Supabase database (via MCP)

- [ ] **Step 1: Descobrir project_id**

Usar `mcp__9e8ef12e-af68-422f-a0dc-bdb409a0b8ee__list_projects`.

- [ ] **Step 2: Criar as tabelas**

Usar `execute_sql`:

```sql
CREATE TABLE IF NOT EXISTS automation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key VARCHAR(50) UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  link VARCHAR(300) NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Verificar**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('automation_configs', 'notifications');
```
Expected: 2 linhas.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Natalia Silva\Documents\02. Renan\4 CLAUDE\1 Projeto Inicial\autocrm"
git commit --allow-empty -m "chore: create automation_configs + notifications tables"
```

---

### Task 2: Tipos TypeScript + lib/automations.ts

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/automations.ts`

- [ ] **Step 1: Adicionar tipos a `lib/types.ts`**

No final do arquivo (após `Interaction`), adicionar:

```ts
export interface AutomationConfig {
  id: string
  automation_key: string
  enabled: boolean
  config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}
```

- [ ] **Step 2: Criar `lib/automations.ts`**

Este arquivo contém apenas metadados estáticos para renderizar a UI. Não vai ao banco.

```ts
export type FieldType = 'checkbox' | 'text' | 'number' | 'select'

export interface AutomationField {
  key: string
  type: FieldType
  label: string
  default: unknown
  options?: string[]          // para type === 'select'
  dependsOn?: string          // key do checkbox que controla visibilidade
  disabled?: boolean          // para features futuras (ex: email)
}

export interface AutomationDefinition {
  key: string
  name: string
  description: string
  badge: string               // emoji ou label de categoria
  fields: AutomationField[]
}

export const AUTOMATION_DEFINITIONS: AutomationDefinition[] = [
  {
    key: 'lead_won',
    name: 'Lead convertido em cliente',
    description: 'Dispara quando um lead vai para o estágio "Ganho".',
    badge: '🏆',
    fields: [
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de onboarding', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Iniciar onboarding', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'high', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'create_transaction', type: 'checkbox', label: 'Criar transação recorrente', default: false },
      { key: 'transaction_amount', type: 'number', label: 'Valor da transação (R$)', default: 0, dependsOn: 'create_transaction' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
      { key: 'send_email', type: 'checkbox', label: 'Enviar e-mail (em breve)', default: false, disabled: true },
    ],
  },
  {
    key: 'proposal_approved',
    name: 'Proposta aprovada',
    description: 'Dispara quando uma proposta é marcada como aprovada.',
    badge: '✅',
    fields: [
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de follow-up', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Follow-up pós-aprovação', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'medium', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
  {
    key: 'lead_lost',
    name: 'Lead perdido',
    description: 'Dispara quando um lead vai para o estágio "Perdido".',
    badge: '❌',
    fields: [
      { key: 'create_note', type: 'checkbox', label: 'Registrar nota automática', default: true },
      { key: 'note_text', type: 'text', label: 'Texto da nota', default: 'Lead perdido. Retomar contato em 90 dias.', dependsOn: 'create_note' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: false },
    ],
  },
  {
    key: 'client_churned',
    name: 'Cliente pausado ou churned',
    description: 'Dispara quando um cliente é marcado como Inativo ou Churned.',
    badge: '⚠️',
    fields: [
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de reengajamento', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Reengajar cliente', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'high', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
  {
    key: 'proposal_no_response',
    name: 'Proposta sem resposta',
    description: 'Proposta enviada há X dias sem mudança de status.',
    badge: '⏰',
    fields: [
      { key: 'days_threshold', type: 'number', label: 'Dias sem resposta', default: 7 },
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de follow-up', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Follow-up: proposta sem resposta', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'high', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
  {
    key: 'client_no_contact',
    name: 'Cliente sem contato',
    description: 'Cliente ativo sem nenhuma interação registrada há X dias.',
    badge: '🔕',
    fields: [
      { key: 'days_threshold', type: 'number', label: 'Dias sem contato', default: 30 },
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de follow-up', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Retomar contato com cliente', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'medium', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
  {
    key: 'task_overdue',
    name: 'Tarefas em atraso',
    description: 'Tarefa com prazo vencido há pelo menos X dias.',
    badge: '🔴',
    fields: [
      { key: 'days_threshold', type: 'number', label: 'Dias em atraso', default: 1 },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
]

export const AUTOMATION_DEFAULTS: Record<string, Record<string, unknown>> = Object.fromEntries(
  AUTOMATION_DEFINITIONS.map((def) => [
    def.key,
    Object.fromEntries(def.fields.map((f) => [f.key, f.default])),
  ])
)

export const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts lib/automations.ts
git commit -m "feat: add AutomationConfig + Notification types and automation definitions"
```

---

### Task 3: Automation Engine (`lib/automation-engine.ts`)

**Files:**
- Create: `lib/automation-engine.ts`

- [ ] **Step 1: Criar `lib/automation-engine.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AutomationContext {
  leadId?: string
  clientId?: string
  proposalId?: string
  taskId?: string
  leadName?: string
  clientName?: string
  clientEmail?: string
}

type Config = Record<string, unknown>

// ── Funções de ação ─────────────────────────────────────────────────────────

async function createTask(
  supabase: SupabaseClient,
  config: Config,
  context: AutomationContext
): Promise<void> {
  if (!config.create_task) return
  await supabase.from('tasks').insert({
    client_id: context.clientId ?? null,
    lead_id: context.leadId ?? null,
    title: (config.task_title as string) ?? 'Tarefa automática',
    priority: (config.task_priority as string) ?? 'medium',
    status: 'pending',
  })
}

async function createTransaction(
  supabase: SupabaseClient,
  config: Config,
  context: AutomationContext
): Promise<void> {
  if (!config.create_transaction || !context.clientId) return
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  await supabase.from('transactions').insert({
    client_id: context.clientId,
    amount: (config.transaction_amount as number) ?? 0,
    type: 'pending',
    date,
    description: 'Transação criada automaticamente',
  })
}

async function createNote(
  supabase: SupabaseClient,
  config: Config,
  context: AutomationContext
): Promise<void> {
  if (!config.create_note || !context.clientId) return
  await supabase.from('interactions').insert({
    client_id: context.clientId,
    type: 'note',
    description: (config.note_text as string) ?? 'Interação automática',
    happened_at: new Date().toISOString(),
  })
}

async function createNotification(
  supabase: SupabaseClient,
  config: Config,
  title: string,
  body: string | null,
  link: string | null
): Promise<void> {
  if (!config.notify) return
  await supabase.from('notifications').insert({ title, body, link })
}

// ── Dispatcher principal ─────────────────────────────────────────────────────

export async function runAutomation(
  supabase: SupabaseClient,
  key: string,
  context: AutomationContext
): Promise<void> {
  const { data: cfg } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', key)
    .single()

  if (!cfg || !cfg.enabled) return

  const config: Config = (cfg.config as Config) ?? {}

  switch (key) {
    case 'lead_won':
      await createTask(supabase, config, context)
      await createTransaction(supabase, config, context)
      await createNotification(
        supabase, config,
        `Lead convertido: ${context.leadName ?? 'novo cliente'}`,
        'Um lead foi convertido em cliente.',
        context.clientId ? `/clients/${context.clientId}` : '/clients'
      )
      break

    case 'proposal_approved':
      await createTask(supabase, config, context)
      await createNotification(
        supabase, config,
        'Proposta aprovada!',
        null,
        context.proposalId ? `/proposals/${context.proposalId}` : '/proposals'
      )
      break

    case 'lead_lost':
      await createNote(supabase, config, context)
      await createNotification(
        supabase, config,
        `Lead perdido: ${context.leadName ?? ''}`,
        (config.note_text as string) ?? null,
        '/pipeline'
      )
      break

    case 'client_churned':
      await createTask(supabase, config, context)
      await createNotification(
        supabase, config,
        `Cliente inativo: ${context.clientName ?? ''}`,
        null,
        context.clientId ? `/clients/${context.clientId}` : '/clients'
      )
      break
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/automation-engine.ts
git commit -m "feat: add automation engine with runAutomation + action functions"
```

---

### Task 4: Notifications API

**Files:**
- Create: `app/api/notifications/route.ts`
- Create: `app/api/notifications/[id]/route.ts`

- [ ] **Step 1: Criar `app/api/notifications/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — últimas 20 notificações (não lidas primeiro)
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// DELETE — marcar todas como lidas
export async function DELETE() {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Criar `app/api/notifications/[id]/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH — marcar notificação individual como lida
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/notifications/route.ts app/api/notifications/[id]/route.ts
git commit -m "feat: add notifications API — GET, DELETE (mark all read), PATCH (mark one read)"
```

---

### Task 5: Automations API (GET + PUT)

**Files:**
- Create: `app/api/automations/route.ts`
- Create: `app/api/automations/[key]/route.ts`

- [ ] **Step 1: Criar `app/api/automations/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTOMATION_DEFINITIONS, AUTOMATION_DEFAULTS } from '@/lib/automations'

// GET — retorna configs de todas as automações, criando as linhas faltantes (seed)
export async function GET() {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('automation_configs')
    .select('*')

  const existingKeys = new Set((existing ?? []).map((c: any) => c.automation_key))

  // Seed: criar linhas para automações que ainda não existem
  const toInsert = AUTOMATION_DEFINITIONS
    .filter((def) => !existingKeys.has(def.key))
    .map((def) => ({
      automation_key: def.key,
      enabled: false,
      config: AUTOMATION_DEFAULTS[def.key] ?? null,
    }))

  if (toInsert.length > 0) {
    await supabase.from('automation_configs').insert(toInsert)
  }

  // Retornar estado atual
  const { data, error } = await supabase
    .from('automation_configs')
    .select('*')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 2: Criar `app/api/automations/[key]/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PUT — salva enabled + config de uma automação pelo key
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const supabase = await createClient()
  const body = await request.json()
  // body: { enabled: boolean, config: Record<string, unknown> }

  const { data, error } = await supabase
    .from('automation_configs')
    .update({
      enabled: body.enabled,
      config: body.config ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('automation_key', key)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/automations/route.ts app/api/automations/[key]/route.ts
git commit -m "feat: add automations API — GET (with seed) + PUT (save config)"
```

---

### Task 6: Scheduled Automations API

**Files:**
- Create: `app/api/automations/run-scheduled/route.ts`

- [ ] **Step 1: Criar `app/api/automations/run-scheduled/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Helpers locais para as ações time-based
async function createTaskLocal(supabase: any, config: any, context: any) {
  if (!config?.create_task) return
  await supabase.from('tasks').insert({
    client_id: context.clientId ?? null,
    lead_id: context.leadId ?? null,
    title: config.task_title ?? 'Tarefa automática',
    priority: config.task_priority ?? 'medium',
    status: 'pending',
  })
}

async function createNotifLocal(supabase: any, config: any, title: string, link: string | null) {
  if (!config?.notify) return
  await supabase.from('notifications').insert({ title, body: null, link })
}

// POST — roda as 3 automações time-based
export async function POST() {
  const supabase = await createClient()

  // ── proposal_no_response ────────────────────────────────────────────────
  const { data: cfg1 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'proposal_no_response')
    .single()

  if (cfg1?.enabled) {
    const days = (cfg1.config?.days_threshold as number) ?? 7
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, client_id, lead_id, updated_at')
      .eq('status', 'sent')
      .lte('updated_at', cutoff)

    for (const p of proposals ?? []) {
      // Verificar duplicata: tarefa com mesmo título criada nas últimas 24h
      const yesterday = new Date(Date.now() - 86_400_000).toISOString()
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('client_id', p.client_id)
        .eq('title', cfg1.config?.task_title ?? 'Follow-up: proposta sem resposta')
        .gte('created_at', yesterday)
        .limit(1)

      if (existing && existing.length > 0) continue

      await createTaskLocal(supabase, cfg1.config, { clientId: p.client_id, leadId: p.lead_id })
      await createNotifLocal(supabase, cfg1.config,
        `Proposta sem resposta há ${days} dias`,
        `/proposals/${p.id}`
      )
    }
  }

  // ── client_no_contact ───────────────────────────────────────────────────
  const { data: cfg2 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'client_no_contact')
    .single()

  if (cfg2?.enabled) {
    const days = (cfg2.config?.days_threshold as number) ?? 30
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'active')

    for (const client of clients ?? []) {
      const { data: lastInteraction } = await supabase
        .from('interactions')
        .select('happened_at')
        .eq('client_id', client.id)
        .order('happened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastDate = lastInteraction?.happened_at ?? null
      if (lastDate && lastDate >= cutoff) continue

      // Anti-duplicata: tarefa criada nas últimas 24h
      const yesterday = new Date(Date.now() - 86_400_000).toISOString()
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('client_id', client.id)
        .eq('title', cfg2.config?.task_title ?? 'Retomar contato com cliente')
        .gte('created_at', yesterday)
        .limit(1)

      if (existing && existing.length > 0) continue

      await createTaskLocal(supabase, cfg2.config, { clientId: client.id })
      await createNotifLocal(supabase, cfg2.config,
        `Sem contato: ${client.name}`,
        `/clients/${client.id}`
      )
    }
  }

  // ── task_overdue ────────────────────────────────────────────────────────
  const { data: cfg3 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'task_overdue')
    .single()

  if (cfg3?.enabled) {
    const days = (cfg3.config?.days_threshold as number) ?? 1
    const cutoffDate = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title')
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lte('due_date', cutoffDate)

    for (const task of tasks ?? []) {
      // Anti-duplicata: notificação criada nas últimas 24h para esta tarefa
      const yesterday = new Date(Date.now() - 86_400_000).toISOString()
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .ilike('title', `%${task.title}%`)
        .gte('created_at', yesterday)
        .limit(1)

      if (existing && existing.length > 0) continue

      if (cfg3.config?.notify) {
        await supabase.from('notifications').insert({
          title: `Tarefa em atraso: ${task.title}`,
          body: null,
          link: '/tasks',
        })
      }
    }
  }

  return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/automations/run-scheduled/route.ts
git commit -m "feat: add scheduled automations endpoint (proposal_no_response, client_no_contact, task_overdue)"
```

---

### Task 7: Wiring nas Rotas de API Existentes

**Files:**
- Modify: `app/api/leads/[id]/route.ts`
- Modify: `app/api/proposals/[id]/route.ts`
- Modify: `app/api/clients/[id]/route.ts`

**Contexto:** Cada rota já existe. Precisamos ler o estado ANTERIOR ao update (para detectar mudança de stage/status) e chamar `runAutomation` **após** o update bem-sucedido, passando o supabase client da própria rota.

- [ ] **Step 1: Modificar `app/api/leads/[id]/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAutomation } from '@/lib/automation-engine'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  // Ler estado anterior (para detectar mudança de stage)
  const { data: prev } = await supabase
    .from('leads')
    .select('stage, name')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('leads')
    .update({
      name: body.name,
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      estimated_value: body.estimated_value ?? 0,
      stage: body.stage,
      notes: body.notes ?? null,
      instagram: body.instagram ?? null,
      website: body.website ?? null,
      source: body.source ?? null,
      next_step: body.next_step ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Automações (fire-and-forget — não bloqueia a resposta)
  if (body.stage && prev?.stage !== body.stage) {
    const context = { leadId: id, leadName: data?.name ?? prev?.name }
    if (body.stage === 'won') {
      void runAutomation(supabase, 'lead_won', { ...context, clientId: body.clientId })
    } else if (body.stage === 'lost') {
      void runAutomation(supabase, 'lead_lost', context)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Modificar `app/api/proposals/[id]/route.ts`**

Adicionar import + leitura de estado anterior + disparo após update:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAutomation } from '@/lib/automation-engine'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('proposals')
    .select(`*, clients(id, name, company, email), leads(id, name, company, email), proposal_items(*, services(name))`)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  // Ler estado anterior
  const { data: prev } = await supabase
    .from('proposals')
    .select('status, client_id')
    .eq('id', id)
    .single()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updates.status = body.status
  if (body.value !== undefined) updates.value = body.value
  if (body.valid_until !== undefined) updates.valid_until = body.valid_until ?? null
  if (body.notes !== undefined) updates.notes = body.notes ?? null

  const { data, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Automação proposal_approved
  if (body.status === 'approved' && prev?.status !== 'approved') {
    void runAutomation(supabase, 'proposal_approved', {
      proposalId: id,
      clientId: data?.client_id ?? prev?.client_id ?? undefined,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('proposals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Modificar `app/api/clients/[id]/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAutomation } from '@/lib/automation-engine'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  // Ler estado anterior
  const { data: prev } = await supabase
    .from('clients')
    .select('status, name')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('clients')
    .update({
      name: body.name,
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      monthly_value: body.monthly_value,
      status: body.status,
      instagram: body.instagram ?? null,
      website: body.website ?? null,
      contact_name: body.contact_name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Automação client_churned
  if (body.status && ['inactive', 'churned'].includes(body.status) && prev?.status === 'active') {
    void runAutomation(supabase, 'client_churned', {
      clientId: id,
      clientName: data?.name ?? prev?.name,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/leads/[id]/route.ts app/api/proposals/[id]/route.ts app/api/clients/[id]/route.ts
git commit -m "feat: wire runAutomation into leads, proposals, clients API routes"
```

---

### Task 8: AutomationCard + Página /automations

**Files:**
- Create: `components/automations/AutomationCard.tsx`
- Create: `app/(dashboard)/automations/page.tsx`

- [ ] **Step 1: Criar `components/automations/AutomationCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { AutomationConfig } from '@/lib/types'
import type { AutomationDefinition } from '@/lib/automations'
import { PRIORITY_LABELS } from '@/lib/automations'
import { useToast } from '@/components/ui/ToastProvider'

interface AutomationCardProps {
  definition: AutomationDefinition
  config: AutomationConfig | null
}

export default function AutomationCard({ definition, config }: AutomationCardProps) {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(config?.enabled ?? false)
  const [values, setValues] = useState<Record<string, unknown>>(
    (config?.config as Record<string, unknown>) ??
    Object.fromEntries(definition.fields.map((f) => [f.key, f.default]))
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/automations/${definition.key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, config: values }),
    })
    if (res.ok) {
      toast(enabled ? 'Automação ativada' : 'Automação desativada')
    } else {
      toast('Erro ao salvar', 'error')
    }
    setSaving(false)
  }

  function handleToggle() {
    setEnabled((p) => !p)
  }

  function setValue(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const inputCls = 'w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className={`bg-[#1e293b] border rounded-xl p-4 transition-colors ${enabled ? 'border-indigo-700' : 'border-slate-700'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{definition.badge}</span>
          <div>
            <p className="text-white text-sm font-semibold">{definition.name}</p>
            <p className="text-slate-500 text-xs mt-0.5">{definition.description}</p>
          </div>
        </div>
        {/* Toggle */}
        <button
          onClick={handleToggle}
          className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      {/* Campos de configuração */}
      {enabled && (
        <div className="space-y-3 mt-3 pt-3 border-t border-slate-700">
          {definition.fields.map((field) => {
            // Se dependsOn, só mostrar se o campo pai for true
            if (field.dependsOn && !values[field.dependsOn]) return null

            return (
              <div key={field.key} className="flex items-center gap-3">
                {field.type === 'checkbox' ? (
                  <>
                    <input
                      type="checkbox"
                      id={`${definition.key}-${field.key}`}
                      checked={Boolean(values[field.key])}
                      onChange={(e) => setValue(field.key, e.target.checked)}
                      disabled={field.disabled}
                      className="w-4 h-4 accent-indigo-500 flex-shrink-0"
                    />
                    <label
                      htmlFor={`${definition.key}-${field.key}`}
                      className={`text-sm ${field.disabled ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-pointer'}`}
                    >
                      {field.label}
                      {field.disabled && <span className="ml-1 text-xs text-slate-600">(em breve)</span>}
                    </label>
                  </>
                ) : field.type === 'text' ? (
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={String(values[field.key] ?? '')}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ) : field.type === 'number' ? (
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                    <input
                      type="number"
                      min="0"
                      value={String(values[field.key] ?? 0)}
                      onChange={(e) => setValue(field.key, parseFloat(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </div>
                ) : field.type === 'select' ? (
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                    <select
                      value={String(values[field.key] ?? field.default)}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      className={inputCls}
                    >
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {PRIORITY_LABELS[opt] ?? opt}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            )
          })}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}

      {/* Quando desligado, mostrar só botão Salvar para persistir o disabled */}
      {!enabled && config !== null && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar desativado'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar `app/(dashboard)/automations/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { AUTOMATION_DEFINITIONS, AUTOMATION_DEFAULTS } from '@/lib/automations'
import type { AutomationConfig } from '@/lib/types'
import AutomationCard from '@/components/automations/AutomationCard'
import { Zap } from 'lucide-react'

export default async function AutomationsPage() {
  const supabase = await createClient()

  // Seed + buscar configs
  const { data: configs } = await supabase
    .from('automation_configs')
    .select('*')

  // Seed local caso a tabela esteja vazia (fallback sem chamada extra)
  const configMap: Record<string, AutomationConfig> = {}
  for (const c of configs ?? []) {
    configMap[c.automation_key] = c
  }

  const eventBased = AUTOMATION_DEFINITIONS.filter((d) =>
    ['lead_won', 'proposal_approved', 'lead_lost', 'client_churned'].includes(d.key)
  )
  const timeBased = AUTOMATION_DEFINITIONS.filter((d) =>
    ['proposal_no_response', 'client_no_contact', 'task_overdue'].includes(d.key)
  )

  async function runScheduled() {
    'use server'
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/automations/run-scheduled`, {
      method: 'POST',
    })
    return res.ok
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Automações</h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure o que acontece automaticamente quando eventos ocorrem
          </p>
        </div>
        <form action={runScheduled}>
          <button
            type="submit"
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Zap size={14} />
            Executar agendadas agora
          </button>
        </form>
      </div>

      {/* Event-based */}
      <div className="mb-8">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Baseadas em eventos
        </h2>
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {eventBased.map((def) => (
            <AutomationCard
              key={def.key}
              definition={def}
              config={configMap[def.key] ?? null}
            />
          ))}
        </div>
      </div>

      {/* Time-based */}
      <div>
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Baseadas em tempo
        </h2>
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {timeBased.map((def) => (
            <AutomationCard
              key={def.key}
              definition={def}
              config={configMap[def.key] ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/automations/AutomationCard.tsx app/(dashboard)/automations/page.tsx
git commit -m "feat: add AutomationCard component and /automations page"
```

---

### Task 9: NotificationBell + Sidebar

**Files:**
- Create: `components/automations/NotificationBell.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Criar `components/automations/NotificationBell.tsx`**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import type { Notification } from '@/lib/types'
import Link from 'next/link'

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'agora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadNotifications() {
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const data = await res.json()
      setNotifications(data)
    }
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'DELETE' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markOneRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="relative flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-200 transition-colors rounded-md hover:bg-slate-700/50"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-full ml-2 top-0 w-80 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <p className="text-white text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-700/30 cursor-pointer ${
                      n.read ? 'opacity-60' : ''
                    }`}
                    onClick={() => markOneRead(n.id)}
                  >
                    {!n.read && (
                      <span className="flex-shrink-0 mt-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
                    )}
                    <div className={`flex-1 min-w-0 ${n.read ? '' : ''}`}>
                      <p className="text-white text-sm font-medium leading-tight">{n.title}</p>
                      {n.body && <p className="text-slate-400 text-xs mt-0.5 truncate">{n.body}</p>}
                      <p className="text-slate-600 text-xs mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setIsOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Modificar `components/layout/Sidebar.tsx`**

2a. Adicionar `Zap` ao import de lucide-react e adicionar `NotificationBell` import.

2b. Adicionar ao `navItems`:
```tsx
{ href: '/automations', icon: Zap, label: 'Automações' },
```
(adicionar após o item de Serviços)

2c. No rodapé do sidebar (antes do `</aside>`), adicionar o `NotificationBell`:
```tsx
{/* Notifications */}
<div className="px-3 py-3 border-t border-slate-700">
  <NotificationBell />
</div>
```

O arquivo completo do Sidebar após as mudanças:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Users,
  FileText,
  DollarSign,
  CheckSquare,
  Settings,
  Zap,
} from 'lucide-react'
import NotificationBell from '@/components/automations/NotificationBell'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/pipeline', icon: Target, label: 'Pipeline' },
  { href: '/clients', icon: Users, label: 'Clientes' },
  { href: '/proposals', icon: FileText, label: 'Propostas' },
  { href: '/financial', icon: DollarSign, label: 'Financeiro' },
  { href: '/tasks', icon: CheckSquare, label: 'Tarefas' },
  { href: '/services', icon: Settings, label: 'Serviços' },
  { href: '/automations', icon: Zap, label: 'Automações' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 min-h-screen bg-[#1e293b] flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-white font-bold text-sm">AutoCRM</span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sininho de notificações */}
      <div className="px-3 py-3 border-t border-slate-700">
        <NotificationBell />
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Verificar no browser**

1. Sidebar mostra item "Automações" com ícone ⚡
2. Sininho 🔔 aparece no rodapé do sidebar
3. `/automations` mostra os 7 cards divididos em 2 seções
4. Ativar uma automação → toggle fica azul, campos aparecem → Salvar → toast
5. Pipeline: mover lead para "Ganho" → se automação `lead_won` ativa, tarefa é criada e notificação aparece no sininho

- [ ] **Step 4: Commit**

```bash
git add components/automations/NotificationBell.tsx components/layout/Sidebar.tsx
git commit -m "feat: add NotificationBell to sidebar + Automações nav item"
```

---

## Checklist de spec coverage

- [x] DB: `automation_configs` com seed automático — Tasks 1, 5
- [x] DB: `notifications` — Task 1
- [x] Tipos TypeScript: AutomationConfig, Notification — Task 2
- [x] `lib/automations.ts`: 7 definições estáticas com campos — Task 2
- [x] `lib/automation-engine.ts`: runAutomation + createTask/Transaction/Note/Notification — Task 3
- [x] API GET/PUT automations — Task 5
- [x] API POST run-scheduled (3 time-based com anti-duplicata) — Task 6
- [x] API GET/DELETE/PATCH notifications — Task 4
- [x] Wiring em leads (won + lost) — Task 7
- [x] Wiring em proposals (approved) — Task 7
- [x] Wiring em clients (churned/inactive) — Task 7
- [x] AutomationCard com toggle + campos dinâmicos + dependsOn — Task 8
- [x] Página /automations com 2 seções + botão "Executar agendadas" — Task 8
- [x] NotificationBell com dropdown, polling 60s, marcar lida — Task 9
- [x] Sidebar: item Automações + NotificationBell — Task 9
