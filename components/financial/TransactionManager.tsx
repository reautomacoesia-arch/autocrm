'use client'

import { useState } from 'react'
import type { TransactionType } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import Badge from '@/components/ui/Badge'
import { Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
import EmptyState from '@/components/ui/EmptyState'

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
  const { toast } = useToast()
  const confirm = useConfirm()
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

  // FN1 — filtros
  const [filterType, setFilterType] = useState<'all' | 'received' | 'pending'>('all')
  const [filterClientId, setFilterClientId] = useState<string>('')
  const [filterMonth, setFilterMonth] = useState<string>('')
  // FN4 — view
  const [activeView, setActiveView] = useState<'transactions' | 'by_client'>('transactions')

  const filteredTransactions = transactions
    .filter((t) => filterType === 'all' || t.type === filterType)
    .filter((t) => !filterClientId || t.client_id === filterClientId)
    .filter((t) => !filterMonth || t.date.startsWith(filterMonth))

  const totalReceived = filteredTransactions
    .filter((t) => t.type === 'received')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalPending = filteredTransactions
    .filter((t) => t.type === 'pending')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalAll = totalReceived + totalPending

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (addSaving) return
    setAddSaving(true)
    const client = clients.find((c) => c.id === addForm.client_id)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: addForm.client_id,
        amount: parseFloat(addForm.amount),
        type: addForm.type,
        date: addForm.date || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })(),
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
      toast('Transação registrada')
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
    if (editSaving) return
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
        prev.map((t) => (t.id === id ? { ...t, ...updated, clients: t.clients } : t))
      )
      setEditingId(null)
      toast('Transação atualizada')
    }
    setEditSaving(false)
  }

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

  function getMonthOptions(): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      opts.push({ value, label })
    }
    return opts
  }
  const monthOptions = getMonthOptions()

  return (
    <div>
      {/* View tabs — FN4 */}
      <div className="flex gap-0 border-b border-slate-700 mb-4">
        <button
          onClick={() => setActiveView('transactions')}
          className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
            activeView === 'transactions'
              ? 'text-indigo-400 border-indigo-500 font-medium'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          📋 Transações
        </button>
        <button
          onClick={() => setActiveView('by_client')}
          className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
            activeView === 'by_client'
              ? 'text-indigo-400 border-indigo-500 font-medium'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          📊 Por cliente
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">MRR</p>
          <p className="text-white text-2xl font-bold">{formatCurrency(mrr)}</p>
          <p className="text-slate-500 text-xs mt-1">{clients.length} cliente(s) ativo(s)</p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Recebido</p>
          <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalReceived)}</p>
          <p className="text-slate-500 text-xs mt-1">
            {filteredTransactions.filter((t) => t.type === 'received').length} transação(ões)
          </p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Pendente</p>
          <p className="text-amber-400 text-lg font-bold">{formatCurrency(totalPending)}</p>
          <p className="text-slate-500 text-xs mt-1">
            {filteredTransactions.filter((t) => t.type === 'pending').length} transação(ões)
          </p>
        </div>
      </div>

      {/* Filtros — FN1 */}
      <div className="flex gap-2 flex-wrap mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | 'received' | 'pending')}
          className="bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="all">Todos os tipos</option>
          <option value="received">Recebido</option>
          <option value="pending">Pendente</option>
        </select>
        <select
          value={filterClientId}
          onChange={(e) => setFilterClientId(e.target.value)}
          className="bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.company ? ` — ${c.company}` : ''}
            </option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">Todos os períodos</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {(filterType !== 'all' || filterClientId || filterMonth) && (
          <button
            onClick={() => { setFilterType('all'); setFilterClientId(''); setFilterMonth('') }}
            className="text-slate-500 hover:text-slate-300 text-sm px-2 transition-colors"
          >
            Limpar filtros ×
          </button>
        )}
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
      {activeView === 'by_client' ? (
        <div className="space-y-2">
          {(() => {
            const map = new Map<string, { name: string; company: string | null; received: number; pending: number; count: number }>()
            for (const t of filteredTransactions) {
              const key = t.client_id
              if (!map.has(key)) {
                map.set(key, {
                  name: t.clients?.name ?? 'Desconhecido',
                  company: t.clients?.company ?? null,
                  received: 0,
                  pending: 0,
                  count: 0,
                })
              }
              const entry = map.get(key)!
              entry.count++
              if (t.type === 'received') entry.received += t.amount
              else entry.pending += t.amount
            }
            const sorted = Array.from(map.values()).sort(
              (a, b) => (b.received + b.pending) - (a.received + a.pending)
            )
            if (sorted.length === 0) {
              return (
                <div className="text-center py-12 text-slate-500 text-sm">
                  Nenhuma transação com os filtros aplicados.
                </div>
              )
            }
            return sorted.map((c, i) => (
              <div key={i} className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{c.name}</p>
                  {c.company && <p className="text-slate-400 text-xs">{c.company}</p>}
                  <p className="text-slate-500 text-xs mt-0.5">{c.count} transação(ões)</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 text-sm font-semibold">{formatCurrency(c.received)}</p>
                  {c.pending > 0 && (
                    <p className="text-amber-400 text-xs">{formatCurrency(c.pending)} pendente</p>
                  )}
                </div>
              </div>
            ))
          })()}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Transações ({filteredTransactions.length})
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
            <EmptyState
              icon="💰"
              title="Nenhuma transação ainda"
              description="Registre o primeiro pagamento para acompanhar o fluxo de caixa."
              action={{ label: 'Registrar transação', onClick: () => setShowAddForm(true) }}
            />
          )}

          <div className="space-y-2">
            {filteredTransactions.map((t) => {
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
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
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
      )}
    </div>
  )
}
