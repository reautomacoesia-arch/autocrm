# Melhorias 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar edição de propostas, CRUD de transações na página global de Financeiro, status bidirecional e expansão de tarefas, calendário mensal no dashboard e página de histórico de atividades com paginação.

**Architecture:** Seis tarefas independentes. Tasks 1–3 são melhorias em componentes existentes. Task 4 cria a API do calendário. Task 5 cria o componente DashboardCalendar e atualiza a página do dashboard. Task 6 cria a página /activity.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase (RLS habilitado), lucide-react

---

## Arquivo Map

| Arquivo | Status | Responsabilidade |
|---|---|---|
| `app/api/proposals/[id]/route.ts` | Modificar | Fix PATCH de spread para allowlist explícita |
| `components/proposals/ProposalDetail.tsx` | Modificar | Adicionar modo de edição inline |
| `components/financial/TransactionManager.tsx` | Criar | Client Component CRUD completo de transações |
| `app/(dashboard)/financial/page.tsx` | Modificar | Passar dados para TransactionManager |
| `components/tasks/TaskList.tsx` | Modificar | Status bidirecional + expand de detalhes |
| `app/api/calendar/route.ts` | Criar | GET tasks + transactions do mês |
| `components/dashboard/DashboardCalendar.tsx` | Criar | Calendário mensal com navegação |
| `app/(dashboard)/page.tsx` | Modificar | Inserir calendário + link "Ver todos" |
| `app/(dashboard)/activity/page.tsx` | Criar | Histórico de atividades paginado |

---

## Task 1: Propostas — Fix API + Edit mode

**Files:**
- Modify: `app/api/proposals/[id]/route.ts`
- Modify: `components/proposals/ProposalDetail.tsx`

- [ ] **Step 1: Fix PATCH allowlist em `app/api/proposals/[id]/route.ts`**

O arquivo atual usa `{ ...body }` (mass assignment). Substituir pelo bloco inteiro do arquivo:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      clients(id, name, company, email),
      leads(id, name, company, email),
      proposal_items(*, services(name))
    `)
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

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
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

- [ ] **Step 2: Adicionar edit mode em `components/proposals/ProposalDetail.tsx`**

Substituir o arquivo inteiro:

```typescript
'use client'

import { useState } from 'react'
import type { Proposal, ProposalItem, ProposalStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'

const STATUS_BADGE: Record<
  ProposalStatus,
  { label: string; variant: 'gray' | 'blue' | 'green' | 'red' }
> = {
  draft: { label: 'Rascunho', variant: 'gray' },
  sent: { label: 'Enviada', variant: 'blue' },
  approved: { label: 'Aprovada', variant: 'green' },
  rejected: { label: 'Recusada', variant: 'red' },
}

const STATUS_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['sent'],
  sent: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

type ProposalWithRelations = Proposal & {
  clients: { id: string; name: string; company: string | null; email: string | null } | null
  leads: { id: string; name: string; company: string | null; email: string | null } | null
  proposal_items: (ProposalItem & { services: { name: string } | null })[]
}

interface ProposalDetailProps {
  proposal: ProposalWithRelations
}

export default function ProposalDetail({ proposal: initial }: ProposalDetailProps) {
  const [proposal, setProposal] = useState(initial)
  const [updating, setUpdating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    value: String(initial.value),
    valid_until: initial.valid_until ?? '',
    notes: initial.notes ?? '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const router = useRouter()

  const contact = proposal.clients ?? proposal.leads
  const transitions = STATUS_TRANSITIONS[proposal.status]

  async function changeStatus(status: ProposalStatus) {
    setUpdating(true)
    const res = await fetch(`/api/proposals/${proposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const updated = await res.json()
    setProposal((prev) => ({ ...prev, status: updated.status }))
    setUpdating(false)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    setEditSaving(true)
    const res = await fetch(`/api/proposals/${proposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: parseFloat(editForm.value),
        valid_until: editForm.valid_until || null,
        notes: editForm.notes || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProposal((prev) => ({
        ...prev,
        value: updated.value,
        valid_until: updated.valid_until,
        notes: updated.notes,
      }))
      setIsEditing(false)
    }
    setEditSaving(false)
  }

  async function deleteProposal() {
    if (!confirm('Excluir esta proposta?')) return
    await fetch(`/api/proposals/${proposal.id}`, { method: 'DELETE' })
    router.push('/proposals')
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {contact && (
              <>
                <h1 className="text-white text-xl font-bold">{contact.name}</h1>
                {contact.company && <p className="text-slate-400 text-sm">{contact.company}</p>}
                {contact.email && <p className="text-slate-500 text-xs mt-1">{contact.email}</p>}
              </>
            )}
            <p className="text-slate-500 text-xs mt-2">
              Criada em {formatDate(proposal.created_at)}
              {proposal.valid_until && ` · Válida até ${formatDate(proposal.valid_until)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE[proposal.status].variant}>
              {STATUS_BADGE[proposal.status].label}
            </Badge>
            <button
              onClick={() => {
                setEditForm({
                  value: String(proposal.value),
                  valid_until: proposal.valid_until ?? '',
                  notes: proposal.notes ?? '',
                })
                setIsEditing(true)
              }}
              className="text-slate-400 hover:text-indigo-400 transition-colors p-1"
              title="Editar proposta"
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>

        {transitions.length > 0 && !isEditing && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
            {transitions.map((status) => (
              <button
                key={status}
                onClick={() => changeStatus(status)}
                disabled={updating}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  status === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : status === 'rejected'
                    ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {status === 'sent'
                  ? 'Marcar como Enviada'
                  : status === 'approved'
                  ? 'Aprovar ✓'
                  : 'Recusar ✗'}
              </button>
            ))}
          </div>
        )}

        {isEditing && (
          <form
            onSubmit={handleEditSave}
            className="mt-4 pt-4 border-t border-slate-700 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Valor total (R$) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={editForm.value}
                  onChange={(e) => setEditForm((p) => ({ ...p, value: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Válida até</label>
                <input
                  type="date"
                  value={editForm.valid_until}
                  onChange={(e) => setEditForm((p) => ({ ...p, valid_until: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Observações</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
              >
                {editSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Items */}
      <div className="mb-6">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Itens da Proposta
        </h2>
        <div className="space-y-2">
          {proposal.proposal_items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
            >
              <div>
                <p className="text-white text-sm">
                  {item.custom_description ?? item.services?.name ?? 'Item sem descrição'}
                </p>
                {item.services && item.custom_description && (
                  <p className="text-slate-500 text-xs">{item.services.name}</p>
                )}
              </div>
              <p className="text-emerald-400 text-sm font-semibold flex-shrink-0 ml-4">
                {formatCurrency(item.price)}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3 pt-3 border-t border-slate-700">
          <p className="text-white font-bold">
            Total:{' '}
            <span className="text-emerald-400">{formatCurrency(proposal.value)}</span>
          </p>
        </div>
      </div>

      {/* Notes */}
      {proposal.notes && !isEditing && (
        <div className="mb-6">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Observações
          </h2>
          <p className="text-slate-300 text-sm bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3">
            {proposal.notes}
          </p>
        </div>
      )}

      <button
        onClick={deleteProposal}
        className="text-slate-500 hover:text-red-400 text-sm transition-colors"
      >
        Excluir proposta
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/proposals/[id]/route.ts components/proposals/ProposalDetail.tsx
git commit -m "feat: add edit mode to ProposalDetail, fix proposals PATCH allowlist"
```

---

## Task 2: Financeiro Global — TransactionManager

**Files:**
- Create: `components/financial/TransactionManager.tsx`
- Modify: `app/(dashboard)/financial/page.tsx`

- [ ] **Step 1: Criar `components/financial/TransactionManager.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { TransactionType } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import Badge from '@/components/ui/Badge'
import { Plus, Trash2 } from 'lucide-react'

interface TransactionWithClient {
  id: string
  client_id: string
  amount: number
  type: TransactionType
  date: string
  description: string | null
  clients: { name: string; company: string | null } | null
}

interface ClientOption {
  id: string
  name: string
  company: string | null
  monthly_value: number
}

interface TransactionManagerProps {
  initialTransactions: TransactionWithClient[]
  clients: ClientOption[]
  mrr: number
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('pt-BR')
}

const TYPE_BADGE: Record<TransactionType, { label: string; variant: 'green' | 'yellow' }> = {
  received: { label: 'Recebido', variant: 'green' },
  pending: { label: 'Pendente', variant: 'yellow' },
}

export default function TransactionManager({
  initialTransactions,
  clients,
  mrr,
}: TransactionManagerProps) {
  const [transactions, setTransactions] = useState<TransactionWithClient[]>(initialTransactions)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    client_id: '',
    amount: '',
    type: 'received' as TransactionType,
    date: '',
    description: '',
  })
  const [addSaving, setAddSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    amount: '',
    type: 'received' as TransactionType,
    date: '',
    description: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  const totalReceived = transactions
    .filter((t) => t.type === 'received')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalPending = transactions
    .filter((t) => t.type === 'pending')
    .reduce((sum, t) => sum + t.amount, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    const client = clients.find((c) => c.id === addForm.client_id)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: addForm.client_id,
        amount: parseFloat(addForm.amount),
        type: addForm.type,
        date: addForm.date || new Date().toISOString().split('T')[0],
        description: addForm.description || null,
      }),
    })
    if (res.ok) {
      const t = await res.json()
      setTransactions((prev) => [
        { ...t, clients: client ? { name: client.name, company: client.company } : null },
        ...prev,
      ])
      setAddForm({ client_id: '', amount: '', type: 'received', date: '', description: '' })
      setShowAddForm(false)
    }
    setAddSaving(false)
  }

  function startEdit(t: TransactionWithClient) {
    setEditingId(t.id)
    setEditForm({
      amount: String(t.amount),
      type: t.type,
      date: t.date,
      description: t.description ?? '',
    })
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setEditSaving(true)
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(editForm.amount),
        type: editForm.type,
        date: editForm.date,
        description: editForm.description || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updated } : t))
      )
      setEditingId(null)
    }
    setEditSaving(false)
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!window.confirm('Remover esta transação?')) return
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  }

  return (
    <div>
      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">MRR</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(mrr)}</p>
          <p className="text-slate-500 text-xs mt-1">{clients.length} cliente(s) ativo(s)</p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Total Recebido</p>
          <p className="text-emerald-400 text-2xl font-bold">{formatCurrency(totalReceived)}</p>
          <p className="text-slate-500 text-xs mt-1">
            {transactions.filter((t) => t.type === 'received').length} transação(ões)
          </p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Pendente</p>
          <p className="text-amber-400 text-2xl font-bold">{formatCurrency(totalPending)}</p>
          <p className="text-slate-500 text-xs mt-1">
            {transactions.filter((t) => t.type === 'pending').length} transação(ões)
          </p>
        </div>
      </div>

      {/* Clients MRR breakdown */}
      {clients.length > 0 && (
        <div className="mb-8">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Receita por Cliente
          </h2>
          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-white text-sm font-medium">{client.name}</p>
                  {client.company && (
                    <p className="text-slate-400 text-xs">{client.company}</p>
                  )}
                </div>
                <p className="text-emerald-400 text-sm font-semibold">
                  {formatCurrency(client.monthly_value)}/mês
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Transações ({transactions.length})
          </h2>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            <Plus size={14} />
            Registrar transação
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAdd}
            className="bg-[#1e293b] border border-slate-700 rounded-lg p-4 mb-4 space-y-3"
          >
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Cliente *</label>
              <select
                required
                value={addForm.client_id}
                onChange={(e) => setAddForm((p) => ({ ...p, client_id: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Selecionar cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` — ${c.company}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={addForm.amount}
                  onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
                  className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="received">Recebido</option>
                  <option value="pending">Pendente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                <input
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Ex: Mensalidade junho"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={addSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
              >
                {addSaving ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </form>
        )}

        {transactions.length === 0 && !showAddForm && (
          <div className="text-center py-16 text-slate-500 text-sm">
            Nenhuma transação registrada ainda. Registre pagamentos nas pastas dos clientes ou clique em "Registrar transação".
          </div>
        )}

        <div className="space-y-2">
          {transactions.map((t) => {
            if (editingId === t.id) {
              return (
                <form
                  key={t.id}
                  onSubmit={(e) => handleEdit(e, t.id)}
                  className="bg-[#1e293b] border border-indigo-500 rounded-lg p-4 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={editForm.amount}
                        onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
                      <select
                        value={editForm.type}
                        onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="received">Recebido</option>
                        <option value="pending">Pendente</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                      <input
                        type="date"
                        required
                        value={editForm.date}
                        onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
                    >
                      {editSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              )
            }

            const badge = TYPE_BADGE[t.type]
            const isOverdue = t.type === 'pending' && parseDate(t.date) < today

            return (
              <div
                key={t.id}
                onClick={() => startEdit(t)}
                className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:border-slate-500 transition-colors"
              >
                <div>
                  <p className="text-white text-sm font-medium">{formatCurrency(t.amount)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.clients && (
                      <p className="text-slate-400 text-xs">
                        {t.clients.name}
                        {t.clients.company ? ` — ${t.clients.company}` : ''}
                      </p>
                    )}
                    {t.description && (
                      <p className="text-slate-500 text-xs">· {t.description}</p>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{formatDate(t.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {isOverdue && <Badge variant="red">Atrasado</Badge>}
                  <button
                    onClick={(e) => handleDelete(e, t.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors ml-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `app/(dashboard)/financial/page.tsx`**

Substituir o arquivo inteiro:

```typescript
import { createClient } from '@/lib/supabase/server'
import TransactionManager from '@/components/financial/TransactionManager'

export default async function FinancialPage() {
  const supabase = await createClient()

  const [clientsRes, transactionsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, company, monthly_value')
      .eq('status', 'active')
      .order('monthly_value', { ascending: false }),
    supabase
      .from('transactions')
      .select('*, clients(name, company)')
      .order('date', { ascending: false })
      .limit(100),
  ])

  const clients = clientsRes.data ?? []
  const transactions = transactionsRes.data ?? []
  const mrr = clients.reduce((sum: number, c: any) => sum + (c.monthly_value || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Financeiro</h1>
        <p className="text-slate-400 text-sm mt-1">Visão geral do fluxo de caixa</p>
      </div>

      <TransactionManager
        initialTransactions={transactions as any}
        clients={clients as any}
        mrr={mrr}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/financial/TransactionManager.tsx app/(dashboard)/financial/page.tsx
git commit -m "feat: financial page CRUD - add/edit/delete transactions globally"
```

---

## Task 3: TaskList — Status bidirecional + Expand de detalhes

**Files:**
- Modify: `components/tasks/TaskList.tsx`

- [ ] **Step 1: Substituir `components/tasks/TaskList.tsx` completo**

```typescript
'use client'

import { useState } from 'react'
import type { Client, Task, TaskPriority, TaskStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import CreateTaskModal from './CreateTaskModal'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

const PRIORITY_BADGE: Record<TaskPriority, { label: string; variant: 'red' | 'yellow' | 'gray' }> = {
  high: { label: 'Alta', variant: 'red' },
  medium: { label: 'Média', variant: 'yellow' },
  low: { label: 'Baixa', variant: 'gray' },
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
}

const STATUS_VARIANT: Record<TaskStatus, 'gray' | 'blue' | 'green'> = {
  pending: 'gray',
  in_progress: 'blue',
  done: 'green',
}

// Next status when clicking circle. done → pending (reopen)
function nextStatus(status: TaskStatus): TaskStatus {
  if (status === 'pending') return 'in_progress'
  if (status === 'in_progress') return 'done'
  return 'pending' // done → pending (reopen)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'done') return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const due = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

interface TaskListProps {
  initialTasks: Task[]
  clients: Client[]
  onTaskAdded?: (task: Task) => void
}

export default function TaskList({ initialTasks, clients, onTaskAdded = () => {} }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]))

  async function advanceStatus(e: React.MouseEvent, task: Task) {
    e.stopPropagation()
    const next = nextStatus(task.status)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
  }

  async function deleteTask(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [task, ...prev])
    onTaskAdded(task)
    setIsModalOpen(false)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all' ? `Todas (${tasks.length})` : STATUS_LABEL[f as TaskStatus]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nova Tarefa
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {filter === 'all'
              ? 'Nenhuma tarefa pendente.'
              : `Nenhuma tarefa "${STATUS_LABEL[filter as TaskStatus]}".`}
          </div>
        ) : (
          filtered.map((task) => {
            const overdue = isOverdue(task.due_date, task.status)
            const priority = PRIORITY_BADGE[task.priority]
            const next = nextStatus(task.status)
            const expanded = expandedId === task.id
            const client = task.client_id ? clientMap[task.client_id] : null

            return (
              <div
                key={task.id}
                className={`bg-[#1e293b] border rounded-lg transition-colors ${
                  overdue ? 'border-red-800' : 'border-slate-700'
                }`}
              >
                {/* Main row */}
                <div
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => toggleExpand(task.id)}
                >
                  {/* Status circle */}
                  <button
                    onClick={(e) => advanceStatus(e, task)}
                    title={
                      task.status === 'done'
                        ? 'Reabrir tarefa'
                        : `Avançar para ${STATUS_LABEL[next]}`
                    }
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors group ${
                      task.status === 'done'
                        ? 'bg-emerald-600 border-emerald-600 hover:bg-red-600 hover:border-red-600'
                        : task.status === 'in_progress'
                        ? 'border-blue-500 bg-blue-500/20 hover:bg-blue-500/40'
                        : 'border-slate-600 hover:border-indigo-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        task.status === 'done' ? 'line-through text-slate-500' : 'text-white'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && !expanded && (
                      <p className="text-slate-400 text-xs mt-0.5 truncate">{task.description}</p>
                    )}
                    {task.due_date && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                          {overdue ? '⚠ ' : ''}Vence: {formatDate(task.due_date)}
                        </span>
                        {client && (
                          <span className="text-xs text-slate-500">• {client.name}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={priority.variant}>{priority.label}</Badge>
                    <Badge variant={STATUS_VARIANT[task.status]}>{STATUS_LABEL[task.status]}</Badge>
                    <button
                      onClick={(e) => deleteTask(e, task.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                    {expanded ? (
                      <ChevronDown size={13} className="text-slate-500" />
                    ) : (
                      <ChevronRight size={13} className="text-slate-500" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-slate-700 mt-0">
                    <div className="pt-3 space-y-2">
                      {task.description && (
                        <div>
                          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Descrição</p>
                          <p className="text-slate-300 text-sm">{task.description}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {task.due_date && (
                          <div>
                            <p className="text-slate-500 uppercase tracking-wider mb-0.5">Vencimento</p>
                            <p className={overdue ? 'text-red-400' : 'text-slate-300'}>
                              {formatDate(task.due_date)}
                              {overdue && ' (atrasado)'}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-slate-500 uppercase tracking-wider mb-0.5">Prioridade</p>
                          <p className="text-slate-300">{priority.label}</p>
                        </div>
                        {client && (
                          <div>
                            <p className="text-slate-500 uppercase tracking-wider mb-0.5">Cliente</p>
                            <Link
                              href={`/clients/${client.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              {client.name}
                            </Link>
                          </div>
                        )}
                        <div>
                          <p className="text-slate-500 uppercase tracking-wider mb-0.5">Status</p>
                          <p className="text-slate-300">{STATUS_LABEL[task.status]}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clients={clients}
        onTaskCreated={handleTaskCreated}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tasks/TaskList.tsx
git commit -m "feat: tasks - bidirectional status toggle, expand details inline"
```

---

## Task 4: Calendar API

**Files:**
- Create: `app/api/calendar/route.ts`

- [ ] **Step 1: Criar `app/api/calendar/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const daysInMonth = new Date(year, month, 0).getDate()
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  const supabase = await createClient()

  const [tasksRes, transactionsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, due_date, status')
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .gte('due_date', firstDay)
      .lte('due_date', lastDay),
    supabase
      .from('transactions')
      .select('id, amount, date, type, clients(name)')
      .eq('type', 'pending')
      .gte('date', firstDay)
      .lte('date', lastDay),
  ])

  return NextResponse.json({
    tasks: tasksRes.data ?? [],
    transactions: transactionsRes.data ?? [],
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/calendar/route.ts
git commit -m "feat: add calendar API route returning tasks and pending transactions by month"
```

---

## Task 5: DashboardCalendar + Dashboard page

**Files:**
- Create: `components/dashboard/DashboardCalendar.tsx`
- Modify: `app/(dashboard)/page.tsx`

- [ ] **Step 1: Criar `components/dashboard/DashboardCalendar.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/pipeline'

interface CalendarTask {
  id: string
  title: string
  due_date: string
  status: string
}

interface CalendarTransaction {
  id: string
  amount: number
  date: string
  type: string
  clients: { name: string } | null
}

interface CalendarData {
  tasks: CalendarTask[]
  transactions: CalendarTransaction[]
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function DashboardCalendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-indexed
  const [data, setData] = useState<CalendarData>({ tasks: [], transactions: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [year, month])

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  // Build calendar grid
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - firstDayOfWeek + 1
    return dayNum >= 1 && dayNum <= daysInMonth ? dayNum : null
  })

  // Group events by day number
  const tasksByDay: Record<number, CalendarTask[]> = {}
  for (const t of data.tasks) {
    const day = parseInt(t.due_date.split('-')[2], 10)
    if (!tasksByDay[day]) tasksByDay[day] = []
    tasksByDay[day].push(t)
  }

  const transactionsByDay: Record<number, CalendarTransaction[]> = {}
  for (const t of data.transactions) {
    const day = parseInt(t.date.split('-')[2], 10)
    if (!transactionsByDay[day]) transactionsByDay[day] = []
    transactionsByDay[day].push(t)
  }

  const todayDay =
    now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : null

  return (
    <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-sm font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-slate-500 text-xs py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center text-slate-500 text-sm py-8">Carregando...</div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-slate-700 rounded-lg overflow-hidden">
          {cells.map((day, i) => {
            if (!day) {
              return <div key={i} className="bg-[#0f172a] min-h-[72px]" />
            }

            const dayTasks = tasksByDay[day] ?? []
            const dayTransactions = transactionsByDay[day] ?? []
            const isToday = day === todayDay
            const hasEvents = dayTasks.length > 0 || dayTransactions.length > 0

            const visibleTasks = dayTasks.slice(0, 2)
            const visibleTransactions = dayTransactions.slice(0, 2)
            const extraTasks = dayTasks.length - visibleTasks.length
            const extraTransactions = dayTransactions.length - visibleTransactions.length
            const totalExtra = extraTasks + extraTransactions

            return (
              <div
                key={i}
                className={`bg-[#1e293b] min-h-[72px] p-1.5 ${
                  isToday ? 'ring-1 ring-inset ring-indigo-500' : ''
                }`}
              >
                <p
                  className={`text-xs mb-1 font-medium text-right ${
                    isToday ? 'text-indigo-400' : hasEvents ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {day}
                </p>
                <div className="space-y-0.5">
                  {visibleTasks.map((t) => (
                    <div
                      key={t.id}
                      title={t.title}
                      className="truncate bg-indigo-900/40 text-indigo-300 text-[10px] rounded px-1 py-0.5 leading-tight"
                    >
                      {t.title}
                    </div>
                  ))}
                  {visibleTransactions.map((t) => (
                    <div
                      key={t.id}
                      title={`${t.clients?.name ?? ''} — ${formatCurrency(t.amount)}`}
                      className="truncate bg-amber-900/40 text-amber-300 text-[10px] rounded px-1 py-0.5 leading-tight"
                    >
                      {formatCurrency(t.amount)}
                    </div>
                  ))}
                  {totalExtra > 0 && (
                    <div className="text-slate-500 text-[10px] px-1">+{totalExtra}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-900/40 border border-indigo-800" />
          <span className="text-slate-500 text-xs">Tarefa</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-900/40 border border-amber-800" />
          <span className="text-slate-500 text-xs">Cobrança pendente</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Atualizar `app/(dashboard)/page.tsx`**

Adicionar dois imports no topo (após os existentes):

```typescript
import DashboardCalendar from '@/components/dashboard/DashboardCalendar'
```

Inserir `<DashboardCalendar />` logo após o fechamento do bloco de metric cards e antes do grid:

```typescript
      {/* Calendar */}
      <DashboardCalendar />

      <div className="grid grid-cols-2 gap-6">
```

Adicionar o link "Ver todos →" na seção de Atividade recente. Substituir o bloco do cabeçalho dessa seção:

```typescript
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Atividade recente
            </h2>
            <Link
              href="/activity"
              className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
            >
              Ver todos →
            </Link>
          </div>
```

O arquivo completo atualizado de `app/(dashboard)/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pipeline'
import MetricCard from '@/components/dashboard/MetricCard'
import DashboardCalendar from '@/components/dashboard/DashboardCalendar'
import Link from 'next/link'

const PRIORITY_COLOR: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-slate-400',
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const TYPE_ICON: Record<string, string> = {
  note: '📝',
  meeting: '📞',
  email: '✉️',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
  }
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatDatetime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day) < new Date(new Date().toDateString())
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const [
    clientsRes,
    leadsRes,
    proposalsRes,
    tasksRes,
    tasksDueRes,
    interactionsRes,
  ] = await Promise.all([
    supabase.from('clients').select('id, monthly_value').eq('status', 'active'),
    supabase.from('leads').select('id').not('stage', 'in', '("won","lost")'),
    supabase.from('proposals').select('id, value').in('status', ['draft', 'sent']),
    supabase.from('tasks').select('id').neq('status', 'done'),
    supabase
      .from('tasks')
      .select('id, title, priority, status, due_date, clients(name)')
      .neq('status', 'done')
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(5),
    supabase
      .from('interactions')
      .select('id, type, description, happened_at, clients(name)')
      .order('happened_at', { ascending: false })
      .limit(5),
  ])

  const clients = clientsRes.data ?? []
  const mrr = clients.reduce((sum: number, c: any) => sum + (c.monthly_value ?? 0), 0)
  const leadsCount = leadsRes.data?.length ?? 0
  const openProposals = proposalsRes.data ?? []
  const openProposalsValue = openProposals.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0)
  const pendingTasksCount = tasksRes.data?.length ?? 0
  const tasksDue = tasksDueRes.data ?? []
  const overdueCount = tasksDue.filter((t: any) => isOverdue(t.due_date)).length
  const recentInteractions = interactionsRes.data ?? []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="MRR"
          value={formatCurrency(mrr)}
          sub={`${clients.length} cliente(s) ativo(s)`}
          color="green"
        />
        <MetricCard
          label="Leads ativos"
          value={String(leadsCount)}
          sub="no pipeline"
          color="indigo"
        />
        <MetricCard
          label="Propostas abertas"
          value={String(openProposals.length)}
          sub={openProposalsValue > 0 ? `${formatCurrency(openProposalsValue)} em jogo` : undefined}
          color="amber"
        />
        <MetricCard
          label="Tarefas pendentes"
          value={String(pendingTasksCount)}
          sub={overdueCount > 0 ? `${overdueCount} em atraso` : undefined}
          color={pendingTasksCount > 0 ? 'amber' : 'white'}
        />
      </div>

      {/* Calendar */}
      <DashboardCalendar />

      <div className="grid grid-cols-2 gap-6">
        {/* Tasks due today / overdue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Tarefas para hoje
            </h2>
            <Link
              href="/tasks"
              className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
            >
              Ver todas →
            </Link>
          </div>
          {tasksDue.length === 0 ? (
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
              Nenhuma tarefa pendente 🎉
            </div>
          ) : (
            <div className="space-y-2">
              {tasksDue.map((task: any) => {
                const overdue = isOverdue(task.due_date)
                return (
                  <div
                    key={task.id}
                    className={`bg-[#1e293b] border rounded-lg px-4 py-3 ${
                      overdue ? 'border-red-800' : 'border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{task.title}</p>
                        {task.clients && (
                          <p className="text-slate-500 text-xs mt-0.5">{task.clients.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-medium ${PRIORITY_COLOR[task.priority] ?? ''}`}>
                          {PRIORITY_LABEL[task.priority] ?? task.priority}
                        </span>
                        {task.due_date && (
                          <span className={`text-xs ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                            {overdue ? '⚠ ' : ''}{formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Atividade recente
            </h2>
            <Link
              href="/activity"
              className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
            >
              Ver todos →
            </Link>
          </div>
          {recentInteractions.length === 0 ? (
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
              Nenhuma interação registrada ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {recentInteractions.map((interaction: any) => (
                <div
                  key={interaction.id}
                  className="bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0 mt-0.5">
                      {TYPE_ICON[interaction.type] ?? '📝'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-sm truncate">{interaction.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {interaction.clients && (
                          <p className="text-slate-500 text-xs">{interaction.clients.name}</p>
                        )}
                        <p className="text-slate-600 text-xs">
                          {formatDatetime(interaction.happened_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DashboardCalendar.tsx app/(dashboard)/page.tsx
git commit -m "feat: add monthly calendar to dashboard, add Ver todos link to activity"
```

---

## Task 6: Activity page com paginação

**Files:**
- Create: `app/(dashboard)/activity/page.tsx`

- [ ] **Step 1: Criar `app/(dashboard)/activity/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const PAGE_SIZE = 10

const TYPE_ICON: Record<string, string> = {
  note: '📝',
  meeting: '📞',
  email: '✉️',
}

const TYPE_LABEL: Record<string, string> = {
  note: 'Nota',
  meeting: 'Reunião',
  email: 'Email',
}

interface Props {
  searchParams: Promise<{ page?: string }>
}

function formatDatetime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ActivityPage({ searchParams }: Props) {
  const { page: pageParam = '1' } = await searchParams
  const page = Math.max(1, parseInt(pageParam))
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()

  const [dataRes, countRes] = await Promise.all([
    supabase
      .from('interactions')
      .select('id, type, description, happened_at, clients(id, name)')
      .order('happened_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true }),
  ])

  const interactions = dataRes.data ?? []
  const total = countRes.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/"
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Dashboard
        </Link>
        <h1 className="text-white text-2xl font-bold mt-2">Histórico de Atividades</h1>
        <p className="text-slate-400 text-sm mt-1">{total} registro(s)</p>
      </div>

      <div className="space-y-2 mb-6">
        {interactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhuma interação registrada ainda.
          </div>
        ) : (
          interactions.map((i: any) => (
            <div
              key={i.id}
              className="bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-sm flex-shrink-0 mt-0.5">
                  {TYPE_ICON[i.type] ?? '📝'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm">{i.description}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-slate-600 text-xs uppercase tracking-wider">
                      {TYPE_LABEL[i.type] ?? i.type}
                    </span>
                    {i.clients && (
                      <Link
                        href={`/clients/${i.clients.id}`}
                        className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
                      >
                        {i.clients.name}
                      </Link>
                    )}
                    <span className="text-slate-600 text-xs">
                      {formatDatetime(i.happened_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 text-sm">
          {page > 1 ? (
            <Link
              href={`/activity?page=${page - 1}`}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              ← Anterior
            </Link>
          ) : (
            <span className="text-slate-600">← Anterior</span>
          )}
          <span className="text-slate-400">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/activity?page=${page + 1}`}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Próxima →
            </Link>
          ) : (
            <span className="text-slate-600">Próxima →</span>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(dashboard)/activity/page.tsx
git commit -m "feat: add /activity page with paginated interaction history"
```

---

## Verificação Final

Após todas as tasks, checar:

- [ ] `git log --oneline -6` — confirmar 6 commits presentes
- [ ] Executar `npx tsc --noEmit` para checar erros de TypeScript

```bash
cd "caminho/do/projeto" && npx tsc --noEmit
```

- [ ] Fazer push para produção:

```bash
git push origin main
```
