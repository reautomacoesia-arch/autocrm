# Spec: Polimento UX — Toasts, Confirm Modal, Empty States, Tab Counters, Última Interação, Kanban Totais

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js App Router, TypeScript, Tailwind CSS v4, Supabase.

---

## Decisões de design (aprovadas)

- **Toast**: compacto, canto superior direito, auto-dismiss 3s, com botão X
- **Confirm Modal**: centralizado, overlay escuro, botão destrutivo vermelho
- **Empty State**: ícone emoji + título + subtítulo + botão CTA opcional
- **Tab counters**: zero oculto, tarefas pendentes em verde
- **Última interação**: borda vermelha + texto laranja se > 30 dias sem contato
- **Kanban totais**: cor mais visível (emerald), formato abreviado (R$ 48k)

---

## 1. Toast System (G1)

### Arquivos
- **Criar:** `components/ui/ToastProvider.tsx`
- **Criar:** `components/layout/Providers.tsx`
- **Modificar:** `app/(dashboard)/layout.tsx`
- **Modificar:** todos os Client Components que fazem mutações (ver lista abaixo)

### `components/ui/ToastProvider.tsx`

Context + hook + container. Exporta `ToastProvider` (component) e `useToast` (hook).

```tsx
'use client'
import { createContext, useCallback, useContext, useState } from 'react'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
}

const COLORS: Record<ToastType, { bg: string; border: string; text: string; close: string }> = {
  success: { bg: 'bg-green-950', border: 'border-green-700', text: 'text-green-100', close: 'text-green-400' },
  error:   { bg: 'bg-red-950',   border: 'border-red-700',   text: 'text-red-100',   close: 'text-red-400' },
  info:    { bg: 'bg-slate-800', border: 'border-slate-600', text: 'text-slate-100', close: 'text-slate-400' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — fixed top-right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const c = COLORS[t.type]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg pointer-events-auto min-w-[260px] max-w-[360px] ${c.bg} ${c.border}`}
            >
              <span className="text-sm flex-shrink-0">{ICONS[t.type]}</span>
              <span className={`text-sm font-medium flex-1 ${c.text}`}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} className={`flex-shrink-0 ${c.close} hover:opacity-70`}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
```

### `components/layout/Providers.tsx`

Client Component que agrupa todos os providers (Toast + Confirm).

```tsx
'use client'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmModal'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
      </ConfirmProvider>
    </ToastProvider>
  )
}
```

### `app/(dashboard)/layout.tsx` — modificar

Envolver `<main>` com `<Providers>`:

```tsx
import Providers from '@/components/layout/Providers'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <main className="flex-1 ml-52 p-8">
        <Providers>{children}</Providers>
      </main>
    </div>
  )
}
```

### Chamadas de toast nos componentes existentes

Após cada operação bem-sucedida (`res.ok`), adicionar `toast("mensagem")`. Adicionar `toast("mensagem", 'error')` quando falhar (apenas onde já há lógica de erro).

| Componente | Ação | Mensagem de toast |
|---|---|---|
| `ClientFolder.tsx` | toggleStatus (pausar) | `"Cliente pausado"` |
| `ClientFolder.tsx` | toggleStatus (reativar) | `"Cliente reativado"` |
| `ClientFolder.tsx` | delete client | `"Cliente removido"` |
| `DataTab.tsx` | salvar dados | `"Dados salvos"` |
| `ProjectsTab.tsx` | salvar edição | `"Projeto atualizado"` |
| `ProjectsTab.tsx` | deletar | `"Projeto removido"` |
| `FinancialTab.tsx` | salvar edição | `"Transação atualizada"` |
| `FinancialTab.tsx` | deletar | `"Transação removida"` |
| `HistoryTab.tsx` | deletar | `"Interação removida"` |
| `TasksTab.tsx` | salvar edição | `"Tarefa atualizada"` |
| `TasksTab.tsx` | deletar | `"Tarefa removida"` |
| `TaskList.tsx` | deletar | `"Tarefa removida"` |
| `TransactionManager.tsx` | registrar | `"Transação registrada"` |
| `TransactionManager.tsx` | salvar edição | `"Transação atualizada"` |
| `TransactionManager.tsx` | deletar | `"Transação removida"` |
| `ProposalDetail.tsx` | salvar edição | `"Proposta atualizada"` |

---

## 2. Confirm Modal (G3)

### Arquivo
- **Criar:** `components/ui/ConfirmModal.tsx`

### Implementação

Context + hook com Promise. `useConfirm()` retorna `confirm(options) => Promise<boolean>`.

```tsx
'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string   // default: "Confirmar"
  destructive?: boolean   // default: false — quando true, botão fica vermelho
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be inside ConfirmProvider')
  return ctx.confirm
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function handleConfirm() {
    resolveRef.current?.(true)
    setOptions(null)
  }

  function handleCancel() {
    resolveRef.current?.(false)
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={handleCancel} />
          {/* Modal */}
          <div className="relative bg-[#1e293b] border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl mx-4">
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl ${options.destructive ? 'bg-red-950' : 'bg-amber-950'}`}>
              {options.destructive ? '🗑️' : '⚠️'}
            </div>
            <h2 className="text-white text-base font-semibold mb-2">{options.title}</h2>
            {options.description && (
              <p className="text-slate-400 text-sm mb-5">{options.description}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2.5 text-sm hover:border-slate-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  options.destructive
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {options.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
```

### Substituição de `window.confirm`

Em cada componente que usa `window.confirm`, substituir por `useConfirm`:

```tsx
// Antes:
if (!window.confirm('Remover esta transação?')) return

// Depois:
const confirm = useConfirm()
// ...
const ok = await confirm({ title: 'Remover transação?', description: 'Esta ação não pode ser desfeita.', destructive: true, confirmLabel: 'Remover' })
if (!ok) return
```

Componentes afetados: `KanbanCard`, `ClientFolder`, `TransactionManager`, `TaskList`, `TasksTab`, `ProjectsTab`, `FinancialTab`, `HistoryTab`.

---

## 3. EmptyState Component (G4)

### Arquivo
- **Criar:** `components/ui/EmptyState.tsx`

### Implementação

```tsx
interface EmptyStateProps {
  icon: string                    // emoji
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-[#1e293b] border-2 border-dashed border-slate-700 rounded-2xl flex items-center justify-center text-2xl mb-4">
        {icon}
      </div>
      <p className="text-white text-sm font-semibold mb-1">{title}</p>
      {description && <p className="text-slate-500 text-sm max-w-xs mb-4">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

### Substituições

| Componente | icon | title | description | action |
|---|---|---|---|---|
| `ClientList` | `👥` | `Nenhum cliente ainda` | `Adicione seu primeiro cliente para organizar projetos e receitas.` | `+ Novo Cliente` → abre modal |
| `TaskList` | `✅` | `Nenhuma tarefa ainda` | `Crie tarefas para acompanhar o que precisa ser feito.` | `+ Nova Tarefa` → abre modal |
| `ProposalList` | `📄` | `Nenhuma proposta ainda` | `Crie uma proposta para um cliente ou lead.` | `+ Nova Proposta` → abre modal |
| `TransactionManager` | `💰` | `Nenhuma transação ainda` | `Registre o primeiro pagamento para acompanhar o fluxo de caixa.` | `Registrar transação` → toggle form |
| `ProjectsTab` | `🚀` | `Nenhum projeto ainda` | `Crie projetos para organizar as entregas deste cliente.` | sem action (criar projeto está no próprio tab) |
| `TasksTab` | `✅` | `Nenhuma tarefa vinculada` | `Crie tarefas no módulo de Tarefas para vinculá-las a este cliente.` | sem action |
| `HistoryTab` | `💬` | `Nenhuma interação registrada` | `Registre notas, reuniões e emails para acompanhar o relacionamento.` | sem action |
| `ServiceList` | `⚙️` | `Nenhum serviço cadastrado` | `Cadastre seus serviços para usá-los nas propostas.` | sem action (botão já existe no topo) |

---

## 4. Tab Counters na Pasta do Cliente (F1)

### Arquivos
- **Criar:** `app/api/clients/[id]/counts/route.ts`
- **Modificar:** `components/clients/folder/ClientFolder.tsx`

### API: `GET /api/clients/[id]/counts`

```ts
// Retorna:
{
  projects: number,
  proposals: number,
  transactions: number,
  interactions: number,
  tasks_pending: number,
  tasks_total: number
}
```

Executa 3 queries em paralelo:
- `projects`: `.from('projects').select('*', { count: 'exact', head: true }).eq('client_id', id)`
- `proposals`: `.from('proposals').select('*', { count: 'exact', head: true }).eq('client_id', id)`
- `transactions`: `.from('transactions').select('*', { count: 'exact', head: true }).eq('client_id', id)`
- `interactions`: `.from('interactions').select('*', { count: 'exact', head: true }).eq('client_id', id)`
- `tasks_total`: `.from('tasks').select('*', { count: 'exact', head: true }).eq('client_id', id)`
- `tasks_pending`: `.from('tasks').select('*', { count: 'exact', head: true }).eq('client_id', id).neq('status', 'done')`

### `ClientFolder.tsx`

Adicionar estado e useEffect:

```tsx
const [counts, setCounts] = useState<Record<string, number>>({})

useEffect(() => {
  fetch(`/api/clients/${client.id}/counts`)
    .then(r => r.json())
    .then(setCounts)
}, [client.id])
```

Renderizar badges nas tabs (omitir se zero, verde se tarefas pendentes):

```tsx
const TABS = [
  { id: 'data',      label: '📊 Dados',      countKey: null },
  { id: 'onboarding',label: '📋 Onboarding', countKey: null },
  { id: 'projects',  label: '🚀 Projetos',   countKey: 'projects' },
  { id: 'proposals', label: '📄 Propostas',  countKey: 'proposals' },
  { id: 'financial', label: '💰 Financeiro', countKey: 'transactions' },
  { id: 'history',   label: '💬 Histórico',  countKey: 'interactions' },
  { id: 'tasks',     label: '✅ Tarefas',    countKey: 'tasks_pending', greenIfPositive: true },
]
```

Badge inline no label da aba:
```tsx
{countKey && counts[countKey] > 0 && (
  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
    greenIfPositive ? 'bg-green-900/50 text-green-400' : 'bg-slate-800 text-slate-500'
  }`}>
    {counts[countKey]}
  </span>
)}
```

---

## 5. Última Interação na Lista de Clientes (C4)

### Arquivos
- **Modificar:** `app/(dashboard)/clients/page.tsx`
- **Modificar:** `components/clients/ClientList.tsx`

### `app/(dashboard)/clients/page.tsx`

Adicionar query de última interação:

```ts
const { data: lastInteractions } = await supabase
  .from('interactions')
  .select('client_id, happened_at')
  .order('happened_at', { ascending: false })

// Reduzir para {client_id → happened_at} mantendo só a mais recente por cliente
const lastInteractionMap: Record<string, string> = {}
for (const row of (lastInteractions ?? [])) {
  if (!lastInteractionMap[row.client_id]) {
    lastInteractionMap[row.client_id] = row.happened_at
  }
}
```

Passar como prop: `<ClientList clients={...} lastInteractions={lastInteractionMap} />`

### `components/clients/ClientList.tsx`

Nova prop: `lastInteractions?: Record<string, string>`

Função helper (UTC-safe, sem import externo):
```ts
function daysAgo(isoStr: string): number {
  const then = new Date(isoStr).setHours(0, 0, 0, 0)
  const now = new Date().setHours(0, 0, 0, 0)
  return Math.floor((now - then) / 86_400_000)
}

function lastContactLabel(isoStr: string | undefined): { text: string; alert: boolean } {
  if (!isoStr) return { text: 'sem contato registrado', alert: false }
  const days = daysAgo(isoStr)
  if (days === 0) return { text: 'contato hoje', alert: false }
  if (days === 1) return { text: 'último contato ontem', alert: false }
  const alert = days > 30
  return { text: `último contato há ${days} dias`, alert }
}
```

Na renderização de cada cliente:
- Exibir texto abaixo da empresa: `· {text}` (slate-500 normal, red-400 se alert)
- Borda do card: `border-red-800` se alert, `border-slate-700` normal

```tsx
const { text: contactText, alert: contactAlert } = lastContactLabel(lastInteractions?.[client.id])
```

---

## 6. Kanban Column Totals — Polimento Visual (P1)

### Arquivo
- **Modificar:** `components/pipeline/KanbanColumn.tsx`

O `totalValue` já é calculado. Apenas ajustar a exibição para mais visibilidade:

```tsx
// Antes:
{totalValue > 0 && (
  <p className="text-slate-500 text-xs">{formatCurrency(totalValue)}</p>
)}

// Depois — no header ao lado do count badge:
<div className="flex items-center justify-between mb-1">
  <h3 className={`text-xs font-semibold uppercase tracking-wider ${STAGE_COLORS[stage]}`}>
    {STAGE_LABELS[stage]}
  </h3>
  <div className="flex items-center gap-1.5">
    {totalValue > 0 && (
      <span className="text-emerald-400 text-xs font-semibold">
        {formatCurrency(totalValue)}
      </span>
    )}
    <span className="text-slate-500 text-xs bg-slate-800 px-2 py-0.5 rounded-full">
      {leads.length}
    </span>
  </div>
</div>
```

Remove a linha `<p className="text-slate-500 text-xs">` que ficava abaixo do header.

---

## Regras Técnicas

- Next.js App Router: `params` é `Promise` — sempre `await`
- `ToastProvider` e `ConfirmProvider` são Client Components — devem ficar dentro de `Providers.tsx`
- `app/(dashboard)/layout.tsx` é Server Component — apenas importa `Providers` (Client Component) e o envolve nos children
- `useConfirm` retorna `Promise<boolean>` — todo handler que usa deve ser `async`
- `useToast` só pode ser chamado em Client Components
- Supabase count queries: `.select('*', { count: 'exact', head: true })`
