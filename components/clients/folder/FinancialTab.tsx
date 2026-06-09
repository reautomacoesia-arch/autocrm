'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Transaction, TransactionType } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { AlertCircle, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

const PAGE_SIZE = 10

const TYPE_BADGE: Record<TransactionType, { label: string; variant: 'green' | 'yellow' }> = {
  received: { label: 'Recebido', variant: 'green' },
  pending:  { label: 'Pendente', variant: 'yellow' },
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
  const { toast } = useToast()
  const confirm = useConfirm()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', type: 'received' as TransactionType, date: '', description: '' })
  const [saving, setSaving] = useState(false)

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', type: 'received' as TransactionType, date: '', description: '' })
  const [editSaving, setEditSaving] = useState(false)

  // Filter & search
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'received' | 'pending' | 'overdue'>('all')
  const [page, setPage] = useState(1)

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  useEffect(() => {
    fetch(`/api/transactions?client_id=${clientId}`)
      .then((r) => r.json())
      .then((d) => { setTransactions(d ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [clientId])

  // Reset page on filter/search change
  useEffect(() => { setPage(1) }, [search, filterType])

  // Summary — always over all transactions
  const totalReceived = transactions.filter((t) => t.type === 'received').reduce((s, t) => s + t.amount, 0)
  const totalPending  = transactions.filter((t) => t.type === 'pending').reduce((s, t) => s + t.amount, 0)
  const overdue       = transactions.filter((t) => t.type === 'pending' && parseDate(t.date) < today)

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      // Type filter
      if (filterType === 'received' && t.type !== 'received') return false
      if (filterType === 'pending'  && t.type !== 'pending')  return false
      if (filterType === 'overdue'  && !(t.type === 'pending' && parseDate(t.date) < today)) return false
      // Search
      if (q) {
        const desc   = (t.description ?? '').toLowerCase()
        const amount = formatCurrency(t.amount).toLowerCase()
        const date   = formatDate(t.date).toLowerCase()
        if (!desc.includes(q) && !amount.includes(q) && !date.includes(q)) return false
      }
      return true
    })
  }, [transactions, filterType, search, today])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:   clientId,
        amount:      parseFloat(form.amount),
        type:        form.type,
        date:        form.date || new Date().toISOString().split('T')[0],
        description: form.description || null,
      }),
    })
    if (res.ok) {
      const transaction = await res.json()
      setTransactions((prev) => [transaction, ...prev])
      setForm({ amount: '', type: 'received', date: '', description: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: 'Remover esta transação?', description: 'Esta ação não pode ser desfeita.', destructive: true, confirmLabel: 'Remover' })
    if (!ok) return
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    toast('Transação removida')
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setEditSaving(true)
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(editForm.amount), type: editForm.type, date: editForm.date, description: editForm.description || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
      setEditingId(null)
      toast('Transação atualizada')
    }
    setEditSaving(false)
  }

  if (loading) return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>

  return (
    <div className="max-w-2xl">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Mensalidade</p>
          <p className="text-white text-lg font-bold">{formatCurrency(monthlyValue)}</p>
        </div>
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Recebido</p>
          <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Pendente</p>
          <p className="text-amber-400 text-lg font-bold">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">LTV Total</p>
          <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalReceived)}</p>
          <p className="text-slate-500 text-xs mt-1">total histórico recebido</p>
        </div>
      </div>

      {/* Alerta de atrasados */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 mb-4 text-red-400 text-xs">
          <AlertCircle size={13} />
          {overdue.length} pagamento(s) em atraso · {formatCurrency(overdue.reduce((s,t) => s + t.amount, 0))} no total
        </div>
      )}

      {/* Header row */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-slate-400 text-sm">{transactions.length} transação(ões)</p>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
          <Plus size={14} /> Registrar pagamento
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
              <input type="number" min="0" step="0.01" required value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="received">Recebido</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Data</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
              <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Ex: Mensalidade janeiro" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium">
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      {/* ── Histórico financeiro ──────────────────────────────────── */}
      <div className="border-t border-slate-800 pt-4">
        <p className="text-slate-300 text-sm font-semibold mb-3">Histórico financeiro</p>

        {/* Search + filter */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição, valor ou data…"
              className="w-full bg-[#111113] border border-slate-700 text-white rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'all',      label: `Todos (${transactions.length})` },
              { key: 'received', label: `Recebidos (${transactions.filter(t=>t.type==='received').length})` },
              { key: 'pending',  label: `Pendentes (${transactions.filter(t=>t.type==='pending').length})` },
              { key: 'overdue',  label: `Atrasados (${overdue.length})` },
            ] as const).map((f) => (
              <button key={f.key} onClick={() => setFilterType(f.key)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  filterType === f.key
                    ? 'bg-indigo-600 text-[#050505] font-medium'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">Nenhuma transação registrada.</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">Nenhum resultado para a busca atual.</div>
        ) : (
          <>
            <div className="space-y-2">
              {paginated.map((t) => {
                if (editingId === t.id) {
                  return (
                    <form key={t.id} onSubmit={(e) => handleEdit(e, t.id)}
                      className="bg-[#1a1a1d] border border-indigo-500 rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
                          <input type="number" min="0" step="0.01" required value={editForm.amount}
                            onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
                          <select value={editForm.type} onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
                            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                            <option value="received">Recebido</option>
                            <option value="pending">Pendente</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                          <input type="date" required value={editForm.date}
                            onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                          <input type="text" value={editForm.description}
                            onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingId(null)} className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm">Cancelar</button>
                        <button type="submit" disabled={editSaving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium">
                          {editSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </form>
                  )
                }

                const badge = TYPE_BADGE[t.type]
                const isOverdue = t.type === 'pending' && parseDate(t.date) < today

                return (
                  <div key={t.id} onClick={() => { setEditingId(t.id); setEditForm({ amount: String(t.amount), type: t.type, date: t.date, description: t.description ?? '' }) }}
                    className="flex items-center justify-between bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:border-slate-500 transition-colors group">
                    <div>
                      <p className="text-white text-sm font-medium">{formatCurrency(t.amount)}</p>
                      {t.description && <p className="text-slate-400 text-xs mt-0.5">{t.description}</p>}
                      <p className="text-slate-500 text-xs mt-0.5">{formatDate(t.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {isOverdue && <Badge variant="red">Atrasado</Badge>}
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                        className="text-slate-600 group-hover:text-slate-400 hover:!text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="text-xs text-slate-500">
                  Página {page} de {totalPages} · {filtered.length} registros
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
