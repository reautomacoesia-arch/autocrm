# Polimento UX — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar sistema de toasts, confirm modal customizado, empty states padronizados, contadores de abas na pasta do cliente, última interação na lista de clientes e totais visuais no Kanban.

**Architecture:** Context API com React para Toast e Confirm (evita prop drilling). Providers são Client Components agrupados em `Providers.tsx`, injetado no layout. EmptyState é um componente puro sem estado. F1, C4 e P1 são melhorias pontuais nos componentes existentes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase, Lucide React

> **Nota:** Este projeto não tem suite de testes. As tarefas usam o padrão: Implementar → Verificar manualmente no browser → Commit.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `components/ui/ToastProvider.tsx` | Criar |
| `components/ui/ConfirmModal.tsx` | Criar |
| `components/ui/EmptyState.tsx` | Criar |
| `components/layout/Providers.tsx` | Criar |
| `app/(dashboard)/layout.tsx` | Modificar |
| `app/api/clients/[id]/counts/route.ts` | Criar |
| `components/clients/folder/ClientFolder.tsx` | Modificar |
| `components/clients/folder/DataTab.tsx` | Modificar |
| `components/clients/folder/ProjectsTab.tsx` | Modificar |
| `components/clients/folder/FinancialTab.tsx` | Modificar |
| `components/clients/folder/HistoryTab.tsx` | Modificar |
| `components/clients/folder/TasksTab.tsx` | Modificar |
| `components/clients/ClientList.tsx` | Modificar |
| `app/(dashboard)/clients/page.tsx` | Modificar |
| `components/tasks/TaskList.tsx` | Modificar |
| `components/pipeline/KanbanCard.tsx` | Modificar |
| `components/pipeline/KanbanColumn.tsx` | Modificar |
| `components/proposals/ProposalList.tsx` | Modificar |
| `components/proposals/ProposalDetail.tsx` | Modificar |
| `components/financial/TransactionManager.tsx` | Modificar |
| `components/services/ServiceList.tsx` | Modificar |

---

### Task 1: ToastProvider

**Files:**
- Create: `components/ui/ToastProvider.tsx`

- [ ] **Step 1: Criar `components/ui/ToastProvider.tsx`**

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

- [ ] **Step 2: Commit**

```bash
git add components/ui/ToastProvider.tsx
git commit -m "feat: add ToastProvider context + useToast hook"
```

---

### Task 2: ConfirmModal

**Files:**
- Create: `components/ui/ConfirmModal.tsx`

- [ ] **Step 1: Criar `components/ui/ConfirmModal.tsx`**

```tsx
'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
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
          <div className="absolute inset-0 bg-black/60" onClick={handleCancel} />
          <div className="relative bg-[#1e293b] border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl mx-4">
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

- [ ] **Step 2: Commit**

```bash
git add components/ui/ConfirmModal.tsx
git commit -m "feat: add ConfirmModal context + useConfirm hook"
```

---

### Task 3: Providers wrapper + layout.tsx

**Files:**
- Create: `components/layout/Providers.tsx`
- Modify: `app/(dashboard)/layout.tsx`

`app/(dashboard)/layout.tsx` atual:
```tsx
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <main className="flex-1 ml-52 p-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 1: Criar `components/layout/Providers.tsx`**

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

- [ ] **Step 2: Modificar `app/(dashboard)/layout.tsx`**

Substituir o conteúdo inteiro por:

```tsx
import Sidebar from '@/components/layout/Sidebar'
import Providers from '@/components/layout/Providers'

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

- [ ] **Step 3: Verificar no browser**

Rodar `npm run dev`. Abrir qualquer página do dashboard. Não deve haver erro de console. Os providers estão invisíveis até que um toast/confirm seja disparado.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Providers.tsx app/(dashboard)/layout.tsx
git commit -m "feat: wrap dashboard layout with Toast + Confirm providers"
```

---

### Task 4: EmptyState component

**Files:**
- Create: `components/ui/EmptyState.tsx`

- [ ] **Step 1: Criar `components/ui/EmptyState.tsx`**

```tsx
interface EmptyStateProps {
  icon: string
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
      {description && (
        <p className="text-slate-500 text-sm max-w-xs mb-4">{description}</p>
      )}
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

- [ ] **Step 2: Commit**

```bash
git add components/ui/EmptyState.tsx
git commit -m "feat: add EmptyState reusable component"
```

---

### Task 5: Toast + Confirm em ClientFolder e DataTab

**Files:**
- Modify: `components/clients/folder/ClientFolder.tsx`
- Modify: `components/clients/folder/DataTab.tsx`

**ClientFolder.tsx** — mudanças:

1. Adicionar imports:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente, antes dos handlers:
```tsx
const { toast } = useToast()
const confirm = useConfirm()
```

3. Substituir `handleToggleStatus`:
```tsx
async function handleToggleStatus() {
  const newStatus = client.status === 'active' ? 'inactive' : 'active'
  const label = newStatus === 'inactive' ? 'pausar' : 'reativar'
  const ok = await confirm({
    title: `Deseja ${label} este cliente?`,
    confirmLabel: newStatus === 'inactive' ? 'Pausar' : 'Reativar',
  })
  if (!ok) return
  const res = await fetch(`/api/clients/${client.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  })
  if (res.ok) {
    const updated = await res.json()
    setClient(updated)
    toast(newStatus === 'inactive' ? 'Cliente pausado' : 'Cliente reativado')
  }
}
```

4. Substituir `handleDelete`:
```tsx
async function handleDelete() {
  const ok = await confirm({
    title: 'Remover este cliente permanentemente?',
    description: 'Esta ação não pode ser desfeita. Todos os dados vinculados serão removidos.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
  if (res.ok) {
    toast('Cliente removido')
    router.push('/clients')
  }
}
```

**DataTab.tsx** — mudanças:

1. Adicionar import:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
```

3. Dentro de `handleSave`, após `setSaved(true)`:
```tsx
if (res.ok) {
  const updated = await res.json()
  onClientUpdated(updated)
  toast('Dados salvos')
  setSaved(true)
  setTimeout(() => setSaved(false), 2000)
}
```

- [ ] **Step 1: Aplicar mudanças em `ClientFolder.tsx`**

Ler o arquivo primeiro, então aplicar os 4 pontos acima.

- [ ] **Step 2: Aplicar mudanças em `DataTab.tsx`**

Ler o arquivo primeiro, então aplicar os 3 pontos acima.

- [ ] **Step 3: Verificar no browser**

Abrir um cliente. Testar:
- Pausar → modal aparece → confirmar → toast "Cliente pausado"
- Cancelar → nada acontece
- Salvar dados → toast "Dados salvos"

- [ ] **Step 4: Commit**

```bash
git add components/clients/folder/ClientFolder.tsx components/clients/folder/DataTab.tsx
git commit -m "feat: add toast + confirm to ClientFolder and DataTab"
```

---

### Task 6: Toast + Confirm em KanbanCard e ProjectsTab

**Files:**
- Modify: `components/pipeline/KanbanCard.tsx`
- Modify: `components/clients/folder/ProjectsTab.tsx`

**KanbanCard.tsx** — `handleDelete` atual usa `window.confirm`. Substituir:

1. Adicionar imports:
```tsx
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente:
```tsx
const confirm = useConfirm()
```

3. Substituir `handleDelete` (tornar async):
```tsx
async function handleDelete(e: React.MouseEvent) {
  e.stopPropagation()
  const ok = await confirm({
    title: `Remover o lead "${lead.name}"?`,
    description: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (ok) {
    onDelete(lead.id)
  }
}
```

**ProjectsTab.tsx** — `handleDelete` usa `window.confirm`. Substituir e adicionar toast:

1. Adicionar imports:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
const confirm = useConfirm()
```

3. Adicionar toast no `handleEdit`, dentro do `if (res.ok)` block:
```tsx
if (res.ok) {
  const updated = await res.json()
  setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)))
  setEditingId(null)
  toast('Projeto atualizado')
}
```

4. Substituir `handleDelete` (tornar async):
```tsx
async function handleDelete(e: React.MouseEvent, projectId: string) {
  e.stopPropagation()
  const ok = await confirm({
    title: 'Remover este projeto?',
    description: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  setProjects((prev) => prev.filter((p) => p.id !== projectId))
  await fetch(`/api/clients/${clientId}/projects/${projectId}`, { method: 'DELETE' })
  toast('Projeto removido')
}
```

- [ ] **Step 1: Aplicar mudanças em `KanbanCard.tsx`**

- [ ] **Step 2: Aplicar mudanças em `ProjectsTab.tsx`**

- [ ] **Step 3: Verificar no browser**

Pipeline: clicar X no card → modal aparece → testar cancelar e confirmar.
Pasta do cliente, aba Projetos: editar → toast "Projeto atualizado"; deletar → modal → toast "Projeto removido".

- [ ] **Step 4: Commit**

```bash
git add components/pipeline/KanbanCard.tsx components/clients/folder/ProjectsTab.tsx
git commit -m "feat: add toast + confirm to KanbanCard and ProjectsTab"
```

---

### Task 7: Toast + Confirm em TaskList e TasksTab

**Files:**
- Modify: `components/tasks/TaskList.tsx`
- Modify: `components/clients/folder/TasksTab.tsx`

**TaskList.tsx** — `deleteTask` atual NÃO tem confirm (só optimistic delete). Adicionar confirm + toast:

1. Adicionar imports:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
const confirm = useConfirm()
```

3. Substituir `deleteTask` (tornar async):
```tsx
async function deleteTask(id: string) {
  const ok = await confirm({
    title: 'Remover esta tarefa?',
    description: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  setTasks((prev) => prev.filter((t) => t.id !== id))
  await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  toast('Tarefa removida')
}
```

**TasksTab.tsx** — `handleDelete` usa `window.confirm`. Substituir e adicionar toast em `handleEdit`:

1. Adicionar imports:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
const confirm = useConfirm()
```

3. Adicionar toast no `handleEdit`, dentro do `if (res.ok)` block:
```tsx
if (res.ok) {
  const updated = await res.json()
  setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
  setEditingId(null)
  toast('Tarefa atualizada')
}
```

4. Substituir `handleDelete` (tornar async):
```tsx
async function handleDelete(e: React.MouseEvent, taskId: string) {
  e.stopPropagation()
  const ok = await confirm({
    title: 'Remover esta tarefa?',
    description: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  setTasks((prev) => prev.filter((t) => t.id !== taskId))
  await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
  toast('Tarefa removida')
}
```

- [ ] **Step 1: Aplicar mudanças em `TaskList.tsx`**

- [ ] **Step 2: Aplicar mudanças em `TasksTab.tsx`**

- [ ] **Step 3: Verificar no browser**

Módulo Tarefas: deletar tarefa → modal → toast "Tarefa removida".
Pasta do cliente, aba Tarefas: editar → toast "Tarefa atualizada"; deletar → modal → toast "Tarefa removida".

- [ ] **Step 4: Commit**

```bash
git add components/tasks/TaskList.tsx components/clients/folder/TasksTab.tsx
git commit -m "feat: add toast + confirm to TaskList and TasksTab"
```

---

### Task 8: Toast + Confirm em TransactionManager e FinancialTab

**Files:**
- Modify: `components/financial/TransactionManager.tsx`
- Modify: `components/clients/folder/FinancialTab.tsx`

**TransactionManager.tsx** — já foi modificado na melhorias-2. Ler o arquivo antes de editar para verificar o estado atual. Adicionar useToast + useConfirm.

Mudanças em TransactionManager:
1. Adicionar imports:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
const confirm = useConfirm()
```

3. Após `handleSave` com `res.ok` → adicionar `toast('Transação registrada')`
4. Após `handleUpdate` com `res.ok` → adicionar `toast('Transação atualizada')`
5. Encontrar a função de delete (pode se chamar `handleDelete`) → adicionar confirm + toast:
```tsx
// Localizar o handler de delete existente e substituir por:
async function handleDelete(id: string) {
  const ok = await confirm({
    title: 'Remover esta transação?',
    description: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  setTransactions((prev) => prev.filter((t) => t.id !== id))
  await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  toast('Transação removida')
}
```

**FinancialTab.tsx** — `handleDelete` NÃO tem confirm (só optimistic delete). `handleAdd` cria a transação sem toast. Adicionar confirm + toast:

1. Adicionar imports:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
const confirm = useConfirm()
```

3. Adicionar toast no `handleEdit`, dentro do `if (res.ok)` block:
```tsx
if (res.ok) {
  const updated = await res.json()
  setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
  setEditingId(null)
  toast('Transação atualizada')
}
```

4. Substituir `handleDelete` (tornar async):
```tsx
async function handleDelete(id: string) {
  const ok = await confirm({
    title: 'Remover esta transação?',
    description: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  setTransactions((prev) => prev.filter((t) => t.id !== id))
  await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  toast('Transação removida')
}
```

Nota: no JSX, o botão de delete chama `handleDelete(t.id)` diretamente (stopPropagation inline), então ele precisa aceitar `id: string` não um MouseEvent. Verificar como está o botão atual e garantir que o `e.stopPropagation()` ainda aconteça no onClick do botão, não dentro do handler.

- [ ] **Step 1: Ler `components/financial/TransactionManager.tsx` para ver estado atual**

- [ ] **Step 2: Aplicar mudanças em `TransactionManager.tsx`**

- [ ] **Step 3: Aplicar mudanças em `FinancialTab.tsx`**

- [ ] **Step 4: Verificar no browser**

Módulo Financeiro: registrar transação → toast "Transação registrada"; editar → toast "Transação atualizada"; deletar → modal → toast "Transação removida".
Pasta do cliente, aba Financeiro: mesmos fluxos.

- [ ] **Step 5: Commit**

```bash
git add components/financial/TransactionManager.tsx components/clients/folder/FinancialTab.tsx
git commit -m "feat: add toast + confirm to TransactionManager and FinancialTab"
```

---

### Task 9: Toast + Confirm em HistoryTab, ProposalDetail e ServiceList

**Files:**
- Modify: `components/clients/folder/HistoryTab.tsx`
- Modify: `components/proposals/ProposalDetail.tsx`
- Modify: `components/services/ServiceList.tsx`

**HistoryTab.tsx** — `handleDelete` NÃO tem confirm (só optimistic delete). Adicionar confirm + toast:

1. Adicionar imports:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
const confirm = useConfirm()
```

3. Substituir `handleDelete` (tornar async):
```tsx
async function handleDelete(id: string) {
  const ok = await confirm({
    title: 'Remover esta interação?',
    description: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  setInteractions((prev) => prev.filter((i) => i.id !== id))
  await fetch(`/api/clients/${clientId}/interactions/${id}`, { method: 'DELETE' })
  toast('Interação removida')
}
```

**ProposalDetail.tsx** — `handleEditSave` salva mas não tem toast. Adicionar:

1. Adicionar import:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
```

3. Dentro de `handleEditSave`, após `if (res.ok)` block, antes de `setIsEditing(false)`:
```tsx
if (res.ok) {
  const updated = await res.json()
  setProposal((prev) => ({ ...prev, ...updated }))
  toast('Proposta atualizada')
  setIsEditing(false)
}
```

(Ler o arquivo antes para confirmar a estrutura exata do `handleEditSave`.)

**ServiceList.tsx** — `handleDelete` usa `confirm()` sem window (bare). Substituir por useConfirm:

1. Adicionar imports:
```tsx
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
```

2. Dentro do componente:
```tsx
const { toast } = useToast()
const confirm = useConfirm()
```

3. Substituir `handleDelete` (tornar async):
```tsx
async function handleDelete(id: string) {
  const ok = await confirm({
    title: 'Remover este serviço?',
    description: 'Esta ação não pode ser desfeita.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  await fetch(`/api/services/${id}`, { method: 'DELETE' })
  setServices((prev) => prev.filter((s) => s.id !== id))
  toast('Serviço removido')
}
```

- [ ] **Step 1: Aplicar mudanças em `HistoryTab.tsx`**

- [ ] **Step 2: Aplicar mudanças em `ProposalDetail.tsx`** (ler antes para confirmar estrutura)

- [ ] **Step 3: Aplicar mudanças em `ServiceList.tsx`**

- [ ] **Step 4: Verificar no browser**

Pasta do cliente, aba Histórico: deletar interação → modal → toast "Interação removida".
Proposta: editar e salvar → toast "Proposta atualizada".
Configurações, Serviços: deletar → modal → toast "Serviço removido".

- [ ] **Step 5: Commit**

```bash
git add components/clients/folder/HistoryTab.tsx components/proposals/ProposalDetail.tsx components/services/ServiceList.tsx
git commit -m "feat: add toast + confirm to HistoryTab, ProposalDetail, ServiceList"
```

---

### Task 10: Empty states em ClientList, TaskList, ProposalList, TransactionManager

**Files:**
- Modify: `components/clients/ClientList.tsx`
- Modify: `components/tasks/TaskList.tsx`
- Modify: `components/proposals/ProposalList.tsx`
- Modify: `components/financial/TransactionManager.tsx`

Para cada arquivo, substituir o bloco `{/* empty state */}` por `<EmptyState ... />`.

**ClientList.tsx** — substituir:
```tsx
// Antes (dentro do bloco filtered.length === 0):
<div className="text-center py-12 text-slate-500 text-sm">
  {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
</div>

// Depois:
{search ? (
  <div className="text-center py-12 text-slate-500 text-sm">
    Nenhum cliente encontrado.
  </div>
) : (
  <EmptyState
    icon="👥"
    title="Nenhum cliente ainda"
    description="Adicione seu primeiro cliente para organizar projetos e receitas."
    action={{ label: '+ Novo Cliente', onClick: () => setIsAddModalOpen(true) }}
  />
)}
```

Adicionar import: `import EmptyState from '@/components/ui/EmptyState'`

**TaskList.tsx** — substituir o empty state de tarefas:
```tsx
// Antes:
<div className="text-center py-12 text-slate-500 text-sm">
  {filter === 'all'
    ? 'Nenhuma tarefa pendente.'
    : `Nenhuma tarefa "${STATUS_LABEL[filter as TaskStatus]}".`}
</div>

// Depois:
{filter === 'all' ? (
  <EmptyState
    icon="✅"
    title="Nenhuma tarefa ainda"
    description="Crie tarefas para acompanhar o que precisa ser feito."
    action={{ label: '+ Nova Tarefa', onClick: () => setIsModalOpen(true) }}
  />
) : (
  <div className="text-center py-12 text-slate-500 text-sm">
    Nenhuma tarefa "{STATUS_LABEL[filter as TaskStatus]}".
  </div>
)}
```

Adicionar import: `import EmptyState from '@/components/ui/EmptyState'`

**ProposalList.tsx** — substituir:
```tsx
// Antes:
<div className="text-center py-12 text-slate-500 text-sm">
  {filter === 'all'
    ? 'Nenhuma proposta criada ainda.'
    : `Nenhuma proposta "${STATUS_BADGE[filter as ProposalStatus].label}".`}
</div>

// Depois:
{filter === 'all' ? (
  <EmptyState
    icon="📄"
    title="Nenhuma proposta ainda"
    description="Crie uma proposta para um cliente ou lead."
    action={{ label: '+ Nova Proposta', onClick: () => setIsModalOpen(true) }}
  />
) : (
  <div className="text-center py-12 text-slate-500 text-sm">
    Nenhuma proposta "{STATUS_BADGE[filter as ProposalStatus].label}".
  </div>
)}
```

Adicionar import: `import EmptyState from '@/components/ui/EmptyState'`

**TransactionManager.tsx** — ler o arquivo para localizar o empty state e substituir:
```tsx
// Substituir o div de empty state por:
<EmptyState
  icon="💰"
  title="Nenhuma transação ainda"
  description="Registre o primeiro pagamento para acompanhar o fluxo de caixa."
  action={{ label: 'Registrar transação', onClick: () => setShowForm(true) }}
/>
```

Adicionar import: `import EmptyState from '@/components/ui/EmptyState'`

- [ ] **Step 1: Aplicar empty state em `ClientList.tsx`**

- [ ] **Step 2: Aplicar empty state em `TaskList.tsx`**

- [ ] **Step 3: Aplicar empty state em `ProposalList.tsx`**

- [ ] **Step 4: Aplicar empty state em `TransactionManager.tsx`** (ler o arquivo antes)

- [ ] **Step 5: Verificar no browser**

Acessar cada módulo vazio (sem dados): Clientes sem clientes, Tarefas sem tarefas, Propostas sem propostas, Financeiro sem transações. Deve mostrar o EmptyState com ícone, título, descrição e botão CTA.

- [ ] **Step 6: Commit**

```bash
git add components/clients/ClientList.tsx components/tasks/TaskList.tsx components/proposals/ProposalList.tsx components/financial/TransactionManager.tsx
git commit -m "feat: replace empty states in ClientList, TaskList, ProposalList, TransactionManager"
```

---

### Task 11: Empty states em ProjectsTab, TasksTab, HistoryTab, ServiceList

**Files:**
- Modify: `components/clients/folder/ProjectsTab.tsx`
- Modify: `components/clients/folder/TasksTab.tsx`
- Modify: `components/clients/folder/HistoryTab.tsx`
- Modify: `components/services/ServiceList.tsx`

**ProjectsTab.tsx** — substituir:
```tsx
// Antes:
<div className="text-center py-12 text-slate-500 text-sm">
  Nenhum projeto cadastrado ainda.
</div>

// Depois:
<EmptyState
  icon="🚀"
  title="Nenhum projeto ainda"
  description="Crie projetos para organizar as entregas deste cliente."
/>
```

Adicionar import: `import EmptyState from '@/components/ui/EmptyState'`

**TasksTab.tsx** — substituir:
```tsx
// Antes:
<div className="text-center py-12 text-slate-500 text-sm">
  Nenhuma tarefa vinculada. Crie tarefas no módulo de Tarefas.
</div>

// Depois:
<EmptyState
  icon="✅"
  title="Nenhuma tarefa vinculada"
  description="Crie tarefas no módulo de Tarefas para vinculá-las a este cliente."
/>
```

Adicionar import: `import EmptyState from '@/components/ui/EmptyState'`

**HistoryTab.tsx** — substituir:
```tsx
// Antes:
<div className="text-center py-12 text-slate-500 text-sm">
  Nenhuma interação registrada ainda.
</div>

// Depois:
<EmptyState
  icon="💬"
  title="Nenhuma interação registrada"
  description="Registre notas, reuniões e emails para acompanhar o relacionamento."
/>
```

Adicionar import: `import EmptyState from '@/components/ui/EmptyState'`

**ServiceList.tsx** — substituir:
```tsx
// Antes:
<div className="text-center py-12 text-slate-500 text-sm">
  Nenhum serviço cadastrado ainda.
</div>

// Depois:
<EmptyState
  icon="⚙️"
  title="Nenhum serviço cadastrado"
  description="Cadastre seus serviços para usá-los nas propostas."
/>
```

Adicionar import: `import EmptyState from '@/components/ui/EmptyState'`

- [ ] **Step 1: Aplicar empty state em `ProjectsTab.tsx`**

- [ ] **Step 2: Aplicar empty state em `TasksTab.tsx`**

- [ ] **Step 3: Aplicar empty state em `HistoryTab.tsx`**

- [ ] **Step 4: Aplicar empty state em `ServiceList.tsx`**

- [ ] **Step 5: Verificar no browser**

Abrir pasta de um cliente novo sem dados. Cada aba vazia deve mostrar EmptyState. Verificar Configurações/Serviços também.

- [ ] **Step 6: Commit**

```bash
git add components/clients/folder/ProjectsTab.tsx components/clients/folder/TasksTab.tsx components/clients/folder/HistoryTab.tsx components/services/ServiceList.tsx
git commit -m "feat: replace empty states in client folder tabs and ServiceList"
```

---

### Task 12: Tab Counters — API de contagens + badges em ClientFolder (F1)

**Files:**
- Create: `app/api/clients/[id]/counts/route.ts`
- Modify: `components/clients/folder/ClientFolder.tsx`

- [ ] **Step 1: Criar `app/api/clients/[id]/counts/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { count: projects },
    { count: proposals },
    { count: transactions },
    { count: interactions },
    { count: tasks_total },
    { count: tasks_pending },
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('interactions').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('client_id', id).neq('status', 'done'),
  ])

  return NextResponse.json({
    projects: projects ?? 0,
    proposals: proposals ?? 0,
    transactions: transactions ?? 0,
    interactions: interactions ?? 0,
    tasks_total: tasks_total ?? 0,
    tasks_pending: tasks_pending ?? 0,
  })
}
```

- [ ] **Step 2: Modificar `ClientFolder.tsx` — adicionar contadores nas abas**

2a. Adicionar import:
```tsx
import { useEffect, useState } from 'react'
```
(Se useEffect e useState já estão importados, pular.)

2b. Substituir a constante `TABS` por uma nova com `countKey` e `greenIfPositive`:
```tsx
const TABS = [
  { id: 'data',      label: '📊 Dados',      countKey: null,            greenIfPositive: false },
  { id: 'onboarding',label: '📋 Onboarding', countKey: null,            greenIfPositive: false },
  { id: 'projects',  label: '🚀 Projetos',   countKey: 'projects',      greenIfPositive: false },
  { id: 'proposals', label: '📄 Propostas',  countKey: 'proposals',     greenIfPositive: false },
  { id: 'financial', label: '💰 Financeiro', countKey: 'transactions',  greenIfPositive: false },
  { id: 'history',   label: '💬 Histórico',  countKey: 'interactions',  greenIfPositive: false },
  { id: 'tasks',     label: '✅ Tarefas',    countKey: 'tasks_pending', greenIfPositive: true  },
]
```

2c. Dentro do componente `ClientFolder`, adicionar estado e fetch de contagens:
```tsx
const [counts, setCounts] = useState<Record<string, number>>({})

useEffect(() => {
  fetch(`/api/clients/${client.id}/counts`)
    .then((r) => r.json())
    .then(setCounts)
    .catch(() => {})
}, [client.id])
```

2d. Substituir a renderização das abas no JSX. Localizar:
```tsx
{TABS.map((tab) => (
  <button
    key={tab.id}
    onClick={() => setTab(tab.id)}
    className={`px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
      activeTab === tab.id
        ? 'text-indigo-400 border-indigo-500 font-medium'
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`}
  >
    {tab.label}
  </button>
))}
```

Substituir por:
```tsx
{TABS.map((tab) => {
  const count = tab.countKey ? (counts[tab.countKey] ?? 0) : 0
  return (
    <button
      key={tab.id}
      onClick={() => setTab(tab.id)}
      className={`px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
        activeTab === tab.id
          ? 'text-indigo-400 border-indigo-500 font-medium'
          : 'text-slate-400 border-transparent hover:text-slate-200'
      }`}
    >
      {tab.label}
      {tab.countKey && count > 0 && (
        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
          tab.greenIfPositive
            ? 'bg-green-900/50 text-green-400'
            : 'bg-slate-800 text-slate-500'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
})}
```

- [ ] **Step 3: Verificar no browser**

Abrir pasta de um cliente com dados. As abas Projetos, Propostas, Financeiro, Histórico devem mostrar contadores em cinza. A aba Tarefas deve mostrar contador verde se houver tarefas pendentes. Zero = sem badge.

- [ ] **Step 4: Commit**

```bash
git add app/api/clients/[id]/counts/route.ts components/clients/folder/ClientFolder.tsx
git commit -m "feat: add tab counters to ClientFolder (F1) via counts API"
```

---

### Task 13: Última interação na lista de clientes (C4)

**Files:**
- Modify: `app/(dashboard)/clients/page.tsx`
- Modify: `components/clients/ClientList.tsx`

- [ ] **Step 1: Modificar `app/(dashboard)/clients/page.tsx`**

Adicionar query de última interação após a query de clientes:
```ts
const { data: lastInteractionsRaw } = await supabase
  .from('interactions')
  .select('client_id, happened_at')
  .order('happened_at', { ascending: false })

const lastInteractionMap: Record<string, string> = {}
for (const row of (lastInteractionsRaw ?? [])) {
  if (!lastInteractionMap[row.client_id]) {
    lastInteractionMap[row.client_id] = row.happened_at
  }
}
```

Atualizar chamada do componente:
```tsx
<ClientList clients={(clients as Client[]) ?? []} lastInteractions={lastInteractionMap} />
```

O arquivo completo ficará:
```tsx
import { createClient } from '@/lib/supabase/server'
import ClientList from '@/components/clients/ClientList'
import type { Client } from '@/lib/types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  const activeCount = (clients ?? []).filter((c) => c.status === 'active').length

  const { data: lastInteractionsRaw } = await supabase
    .from('interactions')
    .select('client_id, happened_at')
    .order('happened_at', { ascending: false })

  const lastInteractionMap: Record<string, string> = {}
  for (const row of (lastInteractionsRaw ?? [])) {
    if (!lastInteractionMap[row.client_id]) {
      lastInteractionMap[row.client_id] = row.happened_at
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Clientes</h1>
          <p className="text-slate-400 text-sm mt-1">{activeCount} ativo(s)</p>
        </div>
      </div>
      <ClientList clients={(clients as Client[]) ?? []} lastInteractions={lastInteractionMap} />
    </div>
  )
}
```

- [ ] **Step 2: Modificar `components/clients/ClientList.tsx`**

2a. Atualizar a interface:
```tsx
interface ClientListProps {
  clients: Client[]
  lastInteractions?: Record<string, string>
}
```

2b. Atualizar a assinatura do componente:
```tsx
export default function ClientList({ clients: initialClients, lastInteractions = {} }: ClientListProps) {
```

2c. Adicionar funções helper antes do `return`, dentro do componente (ou fora como funções puras):
```tsx
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

(Colocar as funções fora do componente, antes do `export default function ClientList`.)

2d. Dentro do `.map((client) => { ... })`, antes do `return (`, adicionar:
```tsx
const { text: contactText, alert: contactAlert } = lastContactLabel(lastInteractions[client.id])
```

2e. Modificar o `<Link>` para trocar a classe de borda quando alert:
```tsx
<Link
  key={client.id}
  href={`/clients/${client.id}`}
  className={`flex items-center justify-between bg-[#1e293b] hover:bg-slate-700/50 border rounded-lg px-4 py-3 transition-colors group ${
    contactAlert
      ? 'border-red-800 hover:border-red-700'
      : 'border-slate-700 hover:border-slate-600'
  }`}
>
```

2f. Modificar a segunda linha abaixo do nome do cliente. Localizar:
```tsx
{client.company && (
  <p className="text-slate-400 text-xs">{client.company}</p>
)}
```

Substituir por:
```tsx
<p className="text-slate-400 text-xs">
  {client.company && <span>{client.company}</span>}
  {client.company && ' · '}
  <span className={contactAlert ? 'text-red-400' : 'text-slate-500'}>
    {contactText}
  </span>
</p>
```

- [ ] **Step 3: Verificar no browser**

Abrir lista de clientes. Clientes com interações recentes mostram "último contato há X dias" em cinza. Clientes sem contato há mais de 30 dias mostram texto vermelho e borda vermelha no card.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/clients/page.tsx components/clients/ClientList.tsx
git commit -m "feat: show last interaction date on client list (C4)"
```

---

### Task 14: Kanban Column Totals — polimento visual (P1)

**Files:**
- Modify: `components/pipeline/KanbanColumn.tsx`

**Estado atual do header em KanbanColumn.tsx:**
```tsx
<div className="mb-3">
  <div className="flex items-center justify-between mb-1">
    <h3 className={`text-xs font-semibold uppercase tracking-wider ${STAGE_COLORS[stage]}`}>
      {STAGE_LABELS[stage]}
    </h3>
    <span className="text-slate-500 text-xs bg-slate-800 px-2 py-0.5 rounded-full">
      {leads.length}
    </span>
  </div>
  {totalValue > 0 && (
    <p className="text-slate-500 text-xs">{formatCurrency(totalValue)}</p>
  )}
</div>
```

- [ ] **Step 1: Substituir o bloco do header**

```tsx
<div className="mb-3">
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
</div>
```

(A linha `{totalValue > 0 && <p className="text-slate-500 ...">` foi removida e o valor foi movido para o header, em emerald-400.)

- [ ] **Step 2: Verificar no browser**

Abrir Pipeline/Kanban. Colunas com valor total exibem o total em verde (emerald) ao lado do badge de contagem, no header. Zero = sem valor exibido.

- [ ] **Step 3: Commit**

```bash
git add components/pipeline/KanbanColumn.tsx
git commit -m "feat: move kanban column total to header with emerald color (P1)"
```

---

## Checklist de spec coverage

- [x] G1: ToastProvider — Tasks 1, 3, 5–9
- [x] G3: ConfirmModal — Tasks 2, 3, 5–9
- [x] G4: EmptyState — Tasks 4, 10, 11
- [x] F1: Tab Counters — Task 12
- [x] C4: Última Interação — Task 13
- [x] P1: Kanban Totals — Task 14
- [x] `Providers.tsx` + layout — Task 3
- [x] Todos os toasts da tabela de spec — Tasks 5–9
- [x] Todos os `window.confirm` / `confirm()` substituídos — Tasks 5–9
