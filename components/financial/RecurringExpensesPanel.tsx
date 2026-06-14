'use client'

import { useState } from 'react'
import type { Client, Expense } from '@/lib/types'
import { EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import { RefreshCw, Pencil } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface RecurringExpensesPanelProps {
  initialRecurringExpenses: Expense[]
  clients: Client[]
}

interface RecurringExpenseForm {
  description: string
  amount: string
  category: string
  customCategory: string
  recurring_day: string
  client_id: string
}

function isSuggestedCategory(category: string | null): boolean {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(category ?? '')
}

function formToExpense(exp: Expense): RecurringExpenseForm {
  const suggested = isSuggestedCategory(exp.category)
  return {
    description: exp.description,
    amount: String(exp.amount),
    category: exp.category ? (suggested ? exp.category : '__custom__') : '',
    customCategory: exp.category && !suggested ? exp.category : '',
    recurring_day: exp.recurring_day ? String(exp.recurring_day) : '',
    client_id: exp.client_id ?? '',
  }
}

const EMPTY_FORM: RecurringExpenseForm = {
  description: '',
  amount: '',
  category: '',
  customCategory: '',
  recurring_day: '',
  client_id: '',
}

/**
 * Painel de configuração: templates de despesa recorrente (recurring=true).
 * Permite editar valor/categoria/dia e interromper a recorrência.
 */
export default function RecurringExpensesPanel({ initialRecurringExpenses, clients }: RecurringExpensesPanelProps) {
  const { toast } = useToast()
  const confirm = useConfirm()

  const [recurringExpenses, setRecurringExpenses] = useState<Expense[]>(initialRecurringExpenses)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<RecurringExpenseForm>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

  function resolveCategory(form: RecurringExpenseForm): string | null {
    if (form.category === '__custom__') return form.customCategory.trim() || null
    return form.category || null
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id)
    setEditForm(formToExpense(exp))
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    if (editSaving) return
    setEditSaving(true)

    const body: Record<string, unknown> = {
      description: editForm.description,
      amount: parseFloat(editForm.amount),
      category: resolveCategory(editForm),
      client_id: editForm.client_id || null,
    }
    if (editForm.recurring_day) {
      body.recurring_day = parseInt(editForm.recurring_day)
    }

    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const updated = await res.json()
      setRecurringExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)))
      setEditingId(null)
      toast('Despesa atualizada')
    } else {
      toast('Erro ao atualizar despesa', 'error')
    }
    setEditSaving(false)
  }

  async function handleStopRecurring(exp: Expense) {
    const ok = await confirm({
      title: 'Parar recorrência?',
      description: `"${exp.description}" não vai mais gerar novas despesas mensais. As instâncias já geradas permanecem no histórico.`,
      confirmLabel: 'Parar recorrência',
    })
    if (!ok) return

    const res = await fetch(`/api/expenses/${exp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recurring: false }),
    })

    if (res.ok) {
      setRecurringExpenses((prev) => prev.filter((e) => e.id !== exp.id))
      toast('Recorrência interrompida')
    } else {
      toast('Erro ao interromper recorrência', 'error')
    }
  }

  if (recurringExpenses.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        Despesas recorrentes configuradas
      </h2>
      <div className="space-y-2">
        {recurringExpenses.map((exp) => {
          if (editingId === exp.id) {
            return (
              <form
                key={exp.id}
                onSubmit={(e) => handleEdit(e, exp.id)}
                className="bg-[#1a1a1d] border border-indigo-500 rounded-lg p-4 space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5">Descrição *</label>
                    <input
                      type="text"
                      required
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={editForm.amount}
                      onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                      className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Dia do mês</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      required
                      value={editForm.recurring_day}
                      onChange={(e) => setEditForm((p) => ({ ...p, recurring_day: e.target.value }))}
                      className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5">Categoria</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Sem categoria</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__custom__">Outra (digitar)...</option>
                    </select>
                    {editForm.category === '__custom__' && (
                      <input
                        type="text"
                        value={editForm.customCategory}
                        onChange={(e) => setEditForm((p) => ({ ...p, customCategory: e.target.value }))}
                        className="w-full mt-2 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        placeholder="Nome da categoria"
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5">Cliente (opcional)</label>
                    <select
                      value={editForm.client_id}
                      onChange={(e) => setEditForm((p) => ({ ...p, client_id: e.target.value }))}
                      className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Geral (sem cliente)</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.company ? ` — ${c.company}` : ''}
                        </option>
                      ))}
                    </select>
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
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium"
                  >
                    {editSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            )
          }

          const client = exp.client_id ? clients.find((c) => c.id === exp.client_id) : null

          return (
            <Card key={exp.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{exp.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {exp.category && <Badge variant="gray">{exp.category}</Badge>}
                  {client && <Badge variant="gray">{client.name}</Badge>}
                  <p className="flex items-center gap-1 text-emerald-600 text-xs">
                    <RefreshCw size={9} />
                    Todo dia {exp.recurring_day}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <p className="text-red-400 text-sm font-semibold">
                  {formatCurrency(exp.amount)}/mês
                </p>
                <button
                  onClick={() => startEdit(exp)}
                  className="text-slate-600 hover:text-indigo-400 transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleStopRecurring(exp)}
                  title="Parar recorrência (mantém o histórico já gerado)"
                  className="text-slate-500 hover:text-red-400 text-xs border border-slate-700 hover:border-red-800/60 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  Parar recorrência
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
