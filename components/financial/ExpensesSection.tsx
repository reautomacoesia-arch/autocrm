'use client'

import { useState } from 'react'
import type { Expense } from '@/lib/types'
import { EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Trash2, RefreshCw, Pencil, Upload } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
import ImportSpreadsheetModal, {
  getCell,
  parseSheetDate,
  parseAmount,
  type ImportColumn,
} from '@/components/financial/ImportSpreadsheetModal'

interface ExpensesSectionProps {
  initialExpenses: Expense[]
  initialRecurringExpenses: Expense[]
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('pt-BR')
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface ExpenseForm {
  description: string
  amount: string
  category: string
  customCategory: string
  date: string
  recurring: boolean
  recurring_day: string
}

const EMPTY_FORM: ExpenseForm = {
  description: '',
  amount: '',
  category: '',
  customCategory: '',
  date: todayStr(),
  recurring: false,
  recurring_day: '',
}

interface ExpenseImportRow {
  description: string
  amount: number
  category: string | null
  date: string
}

const EXPENSE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'description', label: 'Descrição', required: true },
  { key: 'amount', label: 'Valor', required: true },
  { key: 'category', label: 'Categoria' },
  { key: 'date', label: 'Data', required: true },
]

const EXPENSE_IMPORT_TEMPLATE: Record<string, string | number>[] = [
  { Descrição: 'Aluguel', Valor: 3000, Categoria: 'Aluguel', Data: '2026-06-05' },
  { Descrição: 'Figma', Valor: 90, Categoria: 'Ferramentas/Software', Data: '2026-06-10' },
]

function mapAndValidateExpenseRow(
  raw: Record<string, unknown>
): { row?: ExpenseImportRow; error?: string } {
  const description = String(getCell(raw, 'Descrição') ?? '').trim()
  if (!description) return { error: 'Descrição vazia' }

  const amount = parseAmount(getCell(raw, 'Valor'))
  if (amount === null) return { error: 'Valor inválido' }

  const date = parseSheetDate(getCell(raw, 'Data'))
  if (!date) return { error: 'Data inválida' }

  const categoryRaw = getCell(raw, 'Categoria')
  const category = categoryRaw !== undefined && categoryRaw !== null && String(categoryRaw).trim() !== ''
    ? String(categoryRaw).trim()
    : null

  return { row: { description, amount, category, date } }
}

export default function ExpensesSection({
  initialExpenses,
  initialRecurringExpenses,
}: ExpensesSectionProps) {
  const { toast } = useToast()
  const confirm = useConfirm()

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [recurringExpenses, setRecurringExpenses] = useState<Expense[]>(initialRecurringExpenses)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<ExpenseForm>(EMPTY_FORM)
  const [addSaving, setAddSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ExpenseForm>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

  const [showImportModal, setShowImportModal] = useState(false)

  const currentMonth = currentMonthStr()
  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth))
  const totalMonth = monthExpenses.reduce((sum, e) => sum + e.amount, 0)

  function resolveCategory(form: ExpenseForm): string | null {
    if (form.category === '__custom__') return form.customCategory.trim() || null
    return form.category || null
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (addSaving) return
    setAddSaving(true)

    const recurring = addForm.recurring
    const recurringDay = recurring && addForm.recurring_day ? parseInt(addForm.recurring_day) : null

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: addForm.description,
        amount: parseFloat(addForm.amount),
        category: resolveCategory(addForm),
        date: addForm.date || todayStr(),
        recurring,
        recurring_day: recurringDay,
      }),
    })

    if (res.ok) {
      const created = await res.json()
      if (recurring) {
        setRecurringExpenses((prev) => [created, ...prev])
        toast('Despesa recorrente configurada')
      } else {
        setExpenses((prev) => [created, ...prev])
        toast('Despesa registrada')
      }
      setAddForm(EMPTY_FORM)
      setShowAddForm(false)
    } else {
      toast('Erro ao registrar despesa', 'error')
    }
    setAddSaving(false)
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id)
    const isSuggested = (EXPENSE_CATEGORIES as readonly string[]).includes(exp.category ?? '')
    setEditForm({
      description: exp.description,
      amount: String(exp.amount),
      category: exp.category ? (isSuggested ? exp.category : '__custom__') : '',
      customCategory: exp.category && !isSuggested ? exp.category : '',
      date: exp.date,
      recurring: exp.recurring,
      recurring_day: exp.recurring_day ? String(exp.recurring_day) : '',
    })
  }

  async function handleEdit(e: React.FormEvent, id: string, isRecurringTemplate: boolean) {
    e.preventDefault()
    if (editSaving) return
    setEditSaving(true)

    const body: Record<string, unknown> = {
      description: editForm.description,
      amount: parseFloat(editForm.amount),
      category: resolveCategory(editForm),
    }
    if (!isRecurringTemplate) {
      body.date = editForm.date
    } else if (editForm.recurring_day) {
      body.recurring_day = parseInt(editForm.recurring_day)
    }

    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const updated = await res.json()
      if (isRecurringTemplate) {
        setRecurringExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)))
      } else {
        setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)))
      }
      setEditingId(null)
      toast('Despesa atualizada')
    } else {
      toast('Erro ao atualizar despesa', 'error')
    }
    setEditSaving(false)
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Remover esta despesa?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    toast('Despesa removida')
  }

  async function handleImportExpenses(rows: ExpenseImportRow[]): Promise<{ inserted: number; failed: number }> {
    const res = await fetch('/api/expenses/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    if (!res.ok) return { inserted: 0, failed: rows.length }
    return res.json()
  }

  async function handleImportDone() {
    const res = await fetch('/api/expenses?recurring=false')
    if (res.ok) {
      const data = await res.json()
      setExpenses(data)
    }
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

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Despesas
          </h2>
          <p className="text-red-400 text-lg font-bold mt-1">
            {formatCurrency(totalMonth)}
            <span className="text-slate-500 text-xs font-normal ml-2">neste mês</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <Upload size={14} />
            Importar Excel
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            <Plus size={14} />
            Nova despesa
          </button>
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Descrição *</label>
              <input
                type="text"
                required
                value={addForm.description}
                onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Ex: Aluguel do escritório"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={addForm.amount}
                onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Categoria</label>
              <select
                value={addForm.category}
                onChange={(e) => setAddForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Sem categoria</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__custom__">Outra (digitar)...</option>
              </select>
              {addForm.category === '__custom__' && (
                <input
                  type="text"
                  value={addForm.customCategory}
                  onChange={(e) => setAddForm((p) => ({ ...p, customCategory: e.target.value }))}
                  className="w-full mt-2 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Nome da categoria"
                />
              )}
            </div>
            {!addForm.recurring && (
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
            <div className={addForm.recurring ? 'col-span-2' : 'col-span-2'}>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addForm.recurring}
                  onChange={(e) => setAddForm((p) => ({ ...p, recurring: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                Recorrente todo mês
              </label>
              {addForm.recurring && (
                <div className="mt-2">
                  <label className="block text-xs text-slate-400 mb-1.5">Dia do mês (1–31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={addForm.recurring_day}
                    onChange={(e) => setAddForm((p) => ({ ...p, recurring_day: e.target.value }))}
                    className="w-24 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ex: 5"
                  />
                  <p className="text-slate-500 text-xs mt-1.5">
                    Será criado um template; o cron diário gera 1 lançamento por mês neste dia.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM) }}
              className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={addSaving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium"
            >
              {addSaving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      {expenses.length === 0 && !showAddForm && (
        <EmptyState
          icon="💸"
          title="Nenhuma despesa registrada"
          description="Registre os gastos da empresa para acompanhar o fluxo de caixa."
          action={{ label: 'Nova despesa', onClick: () => setShowAddForm(true) }}
        />
      )}

      <div className="space-y-2">
        {expenses.map((exp) => {
          if (editingId === exp.id) {
            return (
              <form
                key={exp.id}
                onSubmit={(e) => handleEdit(e, exp.id, false)}
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
                    <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                    <input
                      type="date"
                      required
                      value={editForm.date}
                      onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
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

          return (
            <div
              key={exp.id}
              onClick={() => startEdit(exp)}
              className="flex items-center justify-between bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:border-slate-500 transition-colors"
            >
              <div>
                <p className="text-red-400 text-sm font-medium">- {formatCurrency(exp.amount)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-slate-300 text-xs">{exp.description}</p>
                  {exp.category && <Badge variant="gray">{exp.category}</Badge>}
                </div>
                <p className="text-slate-500 text-xs mt-0.5">{formatDate(exp.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                {exp.recurring_key && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/20 text-emerald-600 border border-emerald-900/40">
                    <RefreshCw size={8} />
                    Auto
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(exp) }}
                  className="text-slate-600 hover:text-indigo-400 transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(exp.id) }}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recorrentes configuradas */}
      {recurringExpenses.length > 0 && (
        <div className="mt-6">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Recorrentes configuradas
          </h3>
          <div className="space-y-2">
            {recurringExpenses.map((exp) => {
              if (editingId === exp.id) {
                return (
                  <form
                    key={exp.id}
                    onSubmit={(e) => handleEdit(e, exp.id, true)}
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

              return (
                <Card key={exp.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{exp.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {exp.category && <Badge variant="gray">{exp.category}</Badge>}
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
      )}

      <ImportSpreadsheetModal<ExpenseImportRow>
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Importar despesas"
        columns={EXPENSE_IMPORT_COLUMNS}
        templateRows={EXPENSE_IMPORT_TEMPLATE}
        mapAndValidate={mapAndValidateExpenseRow}
        onImport={handleImportExpenses}
        onDone={handleImportDone}
      />
    </div>
  )
}
