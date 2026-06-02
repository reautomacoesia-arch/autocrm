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
