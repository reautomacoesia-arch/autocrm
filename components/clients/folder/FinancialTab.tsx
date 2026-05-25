'use client'

import { useState, useEffect } from 'react'
import type { Transaction, TransactionType } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { Plus, Trash2 } from 'lucide-react'

const TYPE_BADGE: Record<TransactionType, { label: string; variant: 'green' | 'yellow' }> = {
  received: { label: 'Recebido', variant: 'green' },
  pending: { label: 'Pendente', variant: 'yellow' },
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('pt-BR')
}

interface FinancialTabProps {
  clientId: string
  monthlyValue: number
}

export default function FinancialTab({ clientId, monthlyValue }: FinancialTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    type: 'received' as TransactionType,
    date: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    amount: '',
    type: 'received' as TransactionType,
    date: '',
    description: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/transactions?client_id=${clientId}`)
      .then((r) => r.json())
      .then((json) => {
        setTransactions(json ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId])

  const totalReceived = transactions
    .filter((t) => t.type === 'received')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalPending = transactions
    .filter((t) => t.type === 'pending')
    .reduce((sum, t) => sum + t.amount, 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        amount: parseFloat(form.amount),
        type: form.type,
        date: form.date || new Date().toISOString().split('T')[0],
        description: form.description || null,
      }),
    })
    if (!res.ok) {
      setSaving(false)
      return
    }
    const transaction = await res.json()
    setTransactions((prev) => [transaction, ...prev])
    setForm({ amount: '', type: 'received', date: '', description: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setEditForm({
      amount: String(t.amount),
      type: t.type,
      date: t.date,
      description: t.description ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
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
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
      setEditingId(null)
    }
    setEditSaving(false)
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="max-w-2xl">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Mensalidade</p>
          <p className="text-white text-lg font-bold">{formatCurrency(monthlyValue)}</p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Recebido</p>
          <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Pendente</p>
          <p className="text-amber-400 text-lg font-bold">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <p className="text-slate-400 text-sm">{transactions.length} transação(ões)</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          <Plus size={14} />
          Registrar pagamento
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-[#1e293b] border border-slate-700 rounded-lg p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
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
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Ex: Mensalidade janeiro"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
            >
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhuma transação registrada.
          </div>
        ) : (
          transactions.map((t) => {
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
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, type: e.target.value as TransactionType }))
                        }
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
                      onClick={cancelEdit}
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
                  {t.description && (
                    <p className="text-slate-400 text-xs mt-0.5">{t.description}</p>
                  )}
                  <p className="text-slate-500 text-xs mt-0.5">{formatDate(t.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  {isOverdue && <Badge variant="red">Atrasado</Badge>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(t.id)
                    }}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
