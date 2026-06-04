# Spec: Pacote 6 — Motor de Automações

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase.

Sistema de automações pré-configuradas com toggles individuais. Conjunto fixo de 7 automações, cada uma com parâmetros configuráveis pelo usuário. Automações event-based disparam nas rotas de API existentes; automações time-based rodam via endpoint dedicado (chamado manualmente ou por cron externo).

---

## 1. Banco de Dados

### Tabela `automation_configs`

```sql
CREATE TABLE IF NOT EXISTS automation_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key VARCHAR(50) UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `automation_key`: identificador único da automação (ex: `'lead_won'`, `'proposal_no_response'`)
- `config`: JSONB com parâmetros configuráveis por automação (ver seção 3)

### Tabela `notifications`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  link VARCHAR(300) NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `link`: URL interna para onde o clique leva (ex: `/clients/abc`, `/tasks`)
- `read`: false até o usuário marcar como lida

---

## 2. Tipos TypeScript (`lib/types.ts`)

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

---

## 3. Catálogo de Automações

### Automações event-based (disparam imediatamente)

**`lead_won`** — Lead vai para "Ganho"
```jsonc
// config:
{
  "create_task": true,
  "task_title": "Iniciar onboarding",
  "task_priority": "high",           // "high" | "medium" | "low"
  "create_transaction": false,
  "transaction_amount": 0,           // valor em reais
  "notify": true,
  "send_email": false,
  "email_subject": "Bem-vindo(a)!",
  "email_body": "Olá, {client_name}! Bem-vindo(a) à nossa empresa."
}
```
Ações disponíveis: criar tarefa vinculada ao novo cliente, criar transação recorrente (tipo `received`, data = hoje), criar notificação in-app, enviar e-mail (via MCP Gmail se configurado).

**`proposal_approved`** — Proposta aprovada
```jsonc
{
  "create_task": true,
  "task_title": "Follow-up pós-aprovação",
  "task_priority": "medium",
  "notify": true
}
```

**`lead_lost`** — Lead vai para "Perdido"
```jsonc
{
  "create_note": true,
  "note_text": "Lead perdido. Retomar contato em 90 dias.",
  "notify": false
}
```

**`client_churned`** — Cliente vai para status "Churned" ou "Inativo"
```jsonc
{
  "create_task": true,
  "task_title": "Reengajar cliente",
  "task_priority": "high",
  "notify": true
}
```

### Automações time-based (verificadas ao chamar `/api/automations/run-scheduled`)

**`proposal_no_response`** — Proposta enviada sem resposta há X dias
```jsonc
{
  "days_threshold": 7,
  "create_task": true,
  "task_title": "Follow-up: proposta sem resposta",
  "task_priority": "high",
  "notify": true
}
```
Lógica: buscar propostas com `status = 'sent'` e `updated_at <= agora - days_threshold dias`. Criar tarefa vinculada ao `lead_id` ou `client_id` da proposta **apenas se não existir tarefa com esse título já criada recentemente** (evitar duplicatas).

**`client_no_contact`** — Cliente ativo sem contato há X dias
```jsonc
{
  "days_threshold": 30,
  "create_task": true,
  "task_title": "Retomar contato com cliente",
  "task_priority": "medium",
  "notify": true
}
```
Lógica: buscar clientes com `status = 'active'` onde a interação mais recente é mais antiga que `days_threshold` dias (ou nenhuma interação existe).

**`task_overdue`** — Tarefa em atraso há X dias
```jsonc
{
  "days_threshold": 1,
  "notify": true
}
```
Lógica: buscar tarefas com `status != 'done'` e `due_date < agora - days_threshold dias`. Criar notificação in-app para cada tarefa em atraso.

---

## 4. Engine de Automações (`lib/automation-engine.ts`)

Arquivo central com a função `runAutomation` e as funções de ação.

### Interface pública

```ts
export async function runAutomation(
  supabase: SupabaseClient,
  key: string,
  context: AutomationContext
): Promise<void>
```

`AutomationContext` varia por automação:
```ts
export interface AutomationContext {
  leadId?: string
  clientId?: string
  proposalId?: string
  taskId?: string
  leadName?: string
  clientName?: string
  clientEmail?: string
}
```

### Lógica de `runAutomation`

1. Buscar `automation_configs` onde `automation_key = key`
2. Se não encontrado ou `enabled = false`, retornar sem fazer nada
3. Executar ações conforme `config`:

```ts
export async function runAutomation(supabase, key, context) {
  const { data: cfg } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', key)
    .single()

  if (!cfg || !cfg.enabled) return

  const config = cfg.config ?? {}
  await executeAutomationActions(supabase, key, config, context)
}
```

### Funções de ação

```ts
async function createTask(supabase, config, context) {
  if (!config.create_task) return
  await supabase.from('tasks').insert({
    client_id: context.clientId ?? null,
    lead_id: context.leadId ?? null,
    title: config.task_title ?? 'Tarefa automática',
    priority: config.task_priority ?? 'medium',
    status: 'pending',
  })
}

async function createTransaction(supabase, config, context) {
  if (!config.create_transaction || !context.clientId) return
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  await supabase.from('transactions').insert({
    client_id: context.clientId,
    amount: config.transaction_amount ?? 0,
    type: 'pending',
    date,
    description: 'Transação criada automaticamente',
  })
}

async function createNote(supabase, config, context) {
  if (!config.create_note || !context.clientId) return
  await supabase.from('interactions').insert({
    client_id: context.clientId,
    type: 'note',
    description: config.note_text ?? 'Interação automática',
    happened_at: new Date().toISOString(),
  })
}

async function createNotification(supabase, config, context, title, body, link) {
  if (!config.notify) return
  await supabase.from('notifications').insert({ title, body: body ?? null, link: link ?? null })
}

async function sendEmail(supabase, config, context) {
  if (!config.send_email || !context.clientEmail) return
  // Chamada ao MCP Gmail — implementar quando disponível
  // Por ora, apenas loga
  console.log(`[automation] email para ${context.clientEmail}: ${config.email_subject}`)
}
```

### `executeAutomationActions` por key

```ts
async function executeAutomationActions(supabase, key, config, context) {
  switch (key) {
    case 'lead_won':
      await createTask(supabase, config, context)
      await createTransaction(supabase, config, context)
      await createNotification(supabase, config, context,
        `Lead convertido: ${context.leadName ?? 'novo cliente'}`,
        'Um lead foi convertido em cliente.',
        context.clientId ? `/clients/${context.clientId}` : '/clients'
      )
      await sendEmail(supabase, config, context)
      break

    case 'proposal_approved':
      await createTask(supabase, config, context)
      await createNotification(supabase, config, context,
        'Proposta aprovada!',
        null,
        context.proposalId ? `/proposals/${context.proposalId}` : '/proposals'
      )
      break

    case 'lead_lost':
      await createNote(supabase, config, context)
      await createNotification(supabase, config, context,
        `Lead perdido: ${context.leadName ?? ''}`,
        config.note_text ?? null,
        '/pipeline'
      )
      break

    case 'client_churned':
      await createTask(supabase, config, context)
      await createNotification(supabase, config, context,
        `Cliente inativo: ${context.clientName ?? ''}`,
        null,
        context.clientId ? `/clients/${context.clientId}` : '/clients'
      )
      break
  }
}
```

---

## 5. Integração nas Rotas de API Existentes

### `app/api/leads/[id]/route.ts` (PATCH)

Quando `body.stage === 'won'`:
```ts
if (body.stage === 'won' && data?.stage !== 'won') {
  // Buscar cliente criado pela conversão (se existir)
  await runAutomation(supabase, 'lead_won', {
    leadId: id,
    leadName: data?.name,
    clientId: body.clientId ?? undefined,  // passado pelo ConvertToClientModal
  })
}

if (body.stage === 'lost' && data?.stage !== 'lost') {
  await runAutomation(supabase, 'lead_lost', {
    leadId: id,
    leadName: data?.name,
    clientId: undefined,
  })
}
```

### `app/api/proposals/[id]/route.ts` (PATCH)

Quando `body.status === 'approved'`:
```ts
const prev = await supabase.from('proposals').select('status').eq('id', id).single()
if (body.status === 'approved' && prev.data?.status !== 'approved') {
  await runAutomation(supabase, 'proposal_approved', {
    proposalId: id,
    clientId: proposal.client_id ?? undefined,
  })
}
```

### `app/api/clients/[id]/route.ts` (PATCH)

Quando `body.status === 'inactive'` ou `body.status === 'churned'`:
```ts
if (['inactive', 'churned'].includes(body.status)) {
  await runAutomation(supabase, 'client_churned', {
    clientId: id,
    clientName: client?.name,
  })
}
```

---

## 6. Rota de Automações Agendadas

### `app/api/automations/run-scheduled/route.ts` (POST)

```ts
export async function POST() {
  const supabase = await createClient()

  // proposal_no_response
  const { data: cfg1 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'proposal_no_response')
    .single()

  if (cfg1?.enabled) {
    const days = cfg1.config?.days_threshold ?? 7
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, client_id, lead_id, updated_at')
      .eq('status', 'sent')
      .lte('updated_at', cutoff)

    for (const p of proposals ?? []) {
      await createTask(supabase, cfg1.config, { clientId: p.client_id, leadId: p.lead_id })
      await createNotification(supabase, cfg1.config, {},
        'Proposta sem resposta',
        `Proposta enviada há mais de ${days} dias sem resposta.`,
        `/proposals/${p.id}`
      )
    }
  }

  // client_no_contact
  const { data: cfg2 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'client_no_contact')
    .single()

  if (cfg2?.enabled) {
    const days = cfg2.config?.days_threshold ?? 30
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    // Buscar última interação por cliente
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
        .single()

      const lastDate = lastInteraction?.happened_at ?? null
      if (!lastDate || lastDate < cutoff) {
        await createTask(supabase, cfg2.config, { clientId: client.id })
        await createNotification(supabase, cfg2.config, {},
          `Sem contato: ${client.name}`,
          `Cliente sem interação há mais de ${days} dias.`,
          `/clients/${client.id}`
        )
      }
    }
  }

  // task_overdue
  const { data: cfg3 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'task_overdue')
    .single()

  if (cfg3?.enabled) {
    const days = cfg3.config?.days_threshold ?? 1
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, client_id')
      .neq('status', 'done')
      .lte('due_date', cutoff)

    for (const task of tasks ?? []) {
      await createNotification(supabase, cfg3.config, {},
        `Tarefa em atraso: ${task.title}`,
        null,
        '/tasks'
      )
    }
  }

  return NextResponse.json({ success: true })
}
```

---

## 7. APIs de Notificações

### `app/api/notifications/route.ts`

```ts
// GET — lista notificações não lidas (limit 20)
// DELETE — marca todas como lidas
```

### `app/api/notifications/[id]/route.ts`

```ts
// PATCH — marcar individual como lida
```

---

## 8. UI — Página de Automações (`/automations`)

### Sidebar
Adicionar item ao nav: `{ href: '/automations', icon: Zap, label: 'Automações' }`

### Layout da página
```
/automations
├── Header "Automações" + botão "Executar agendadas agora"
├── Seção "Baseadas em eventos" (4 cards)
└── Seção "Baseadas em tempo" (3 cards)
```

### Card de automação
Cada card mostra:
- Nome + descrição do gatilho
- Toggle ativo/inativo
- Quando ativado: formulário inline com os parâmetros configuráveis (checkboxes + inputs)
- Botão "Salvar" por card

### Componente `AutomationCard`
```tsx
interface AutomationCardProps {
  definition: AutomationDefinition  // metadata estático (nome, descrição, campos)
  config: AutomationConfig | null   // dados do banco (enabled + config JSONB)
  onSave: (key: string, enabled: boolean, config: Record<string, unknown>) => Promise<void>
}
```

`AutomationDefinition` é um objeto estático em `lib/automations.ts` com metadados de cada automação (não vai ao banco, só serve para renderizar a UI).

---

## 9. UI — Sininho de Notificações

### Componente `NotificationBell` (no Sidebar ou header)
- Ícone 🔔 com badge de contagem de não lidas
- Click abre dropdown com as últimas 10 notificações
- Cada notificação tem título + tempo relativo ("há 2 minutos") + link clicável
- Botão "Marcar todas como lidas"
- Polling leve: revalidar a cada 60s (ou via `revalidatePath` após ação)

---

## 10. Regras técnicas

- `runAutomation` recebe o Supabase client da própria rota (não cria um novo) — evita overhead
- Automações time-based não criam duplicatas: verificar se já existe tarefa com mesmo título e `client_id` criada nas últimas 24h antes de inserir
- `automation_configs` usa seed inicial: ao iniciar a app pela primeira vez, criar as 7 linhas com `enabled = false` e `config` com valores default — isso acontece na rota GET `/api/automations` se as linhas não existirem
- E-mail (`send_email`) apenas loga no console por ora — stub para integração futura com MCP Gmail
- Sem multi-tenancy: tabelas sem `user_id` — sistema single-tenant como o resto do CRM

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| Supabase DB | Migration — `automation_configs` + `notifications` |
| `lib/types.ts` | Adicionar `AutomationConfig`, `Notification` |
| `lib/automations.ts` | Criar — definições estáticas das 7 automações |
| `lib/automation-engine.ts` | Criar — `runAutomation` + funções de ação |
| `app/api/automations/route.ts` | Criar — GET lista configs + seed inicial |
| `app/api/automations/[key]/route.ts` | Criar — PUT salva config de uma automação |
| `app/api/automations/run-scheduled/route.ts` | Criar — POST roda time-based |
| `app/api/notifications/route.ts` | Criar — GET + DELETE (marcar todas lidas) |
| `app/api/notifications/[id]/route.ts` | Criar — PATCH (marcar uma lida) |
| `app/api/leads/[id]/route.ts` | Modificar — chamar `runAutomation` em lead_won + lead_lost |
| `app/api/proposals/[id]/route.ts` | Modificar — chamar `runAutomation` em proposal_approved |
| `app/api/clients/[id]/route.ts` | Modificar — chamar `runAutomation` em client_churned |
| `components/automations/AutomationCard.tsx` | Criar — card de automação com toggle + form |
| `components/automations/NotificationBell.tsx` | Criar — sininho com dropdown |
| `app/(dashboard)/automations/page.tsx` | Criar — página /automations |
| `components/layout/Sidebar.tsx` | Modificar — adicionar item Automações |
