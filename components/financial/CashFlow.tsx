'use client'

import { useMemo, useState } from 'react'
import type { Client, Expense, Transaction, TransactionType } from '@/lib/types'
import { EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import { formatDate } from '@/lib/format-date'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
import { useBulkSelection, bulkRun } from '@/lib/hooks/useBulkSelection'
import BulkActionBar from '@/components/ui/BulkActionBar'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Upload,
  Search,
} from 'lucide-react'
import ImportSpreadsheetModal, {
  getCell,
  parseSheetDate,
  parseAmount,
  type ImportColumn,
} from '@/components/financial/ImportSpreadsheetModal'
import CashFlowCharts from '@/components/financial/CashFlowCharts'

type TransactionWithClient = Transaction & {
  clients: { name: string; company: string | null } | null
}

interface CashFlowProps {
  transactions: TransactionWithClient[]
  expenses: Expense[]
  clients: Client[]
}

type EntryKind = 'income' | 'expense'

interface Entry {
  id: string
  kind: EntryKind
  date: string
  description: string
  detail: string
  amount: number
  status?: TransactionType
  clientId: string | null
  raw: TransactionWithClient | Expense
}

type TypeFilter = 'all' | 'income' | 'expense'
type PeriodShortcut = 'this_month' | 'last_month' | 'this_year' | 'all'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

function periodRange(shortcut: PeriodShortcut): { from: string | null; to: string | null } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  switch (shortcut) {
    case 'this_month':
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) }
    case 'last_month':
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) }
    case 'this_year':
      return { from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y, 11, 31)) }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

// ---- Import: receitas (transactions) ----

interface TransactionImportRow {
  client_id: string
  amount: number
  type: TransactionType
  date: string
  description: string | null
}

const TRANSACTION_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'client', label: 'Cliente', required: true },
  { key: 'amount', label: 'Valor', required: true },
  { key: 'date', label: 'Data', required: true },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Descrição' },
]

const TRANSACTION_IMPORT_TEMPLATE: Record<string, string | number>[] = [
  { Cliente: 'Nome do cliente', Valor: 1500, Data: '2026-06-10', Status: 'recebido', Descrição: 'Mensalidade junho' },
  { Cliente: 'Nome do cliente', Valor: 1500, Data: '2026-07-10', Status: 'pendente', Descrição: 'Mensalidade julho' },
]

// ---- Import: despesas (expenses) ----

interface ExpenseImportRow {
  description: string
  amount: number
  category: string | null
  date: string
  client_id: string | null
}

const EXPENSE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'description', label: 'Descrição', required: true },
  { key: 'amount', label: 'Valor', required: true },
  { key: 'category', label: 'Categoria' },
  { key: 'date', label: 'Data', required: true },
  { key: 'client', label: 'Cliente' },
]

const EXPENSE_IMPORT_TEMPLATE: Record<string, string | number>[] = [
  { Descrição: 'Aluguel', Valor: 3000, Categoria: 'Aluguel', Data: '2026-06-05', Cliente: '' },
  { Descrição: 'Figma', Valor: 90, Categoria: 'Ferramentas/Software', Data: '2026-06-10', Cliente: 'Nome do cliente' },
]

interface IncomeForm {
  client_id: string
  amount: string
  type: TransactionType
  date: string
  description: string
}

interface ExpenseForm {
  description: string
  amount: string
  category: string
  customCategory: string
  date: string
  recurring: boolean
  recurring_day: string
  client_id: string
}

const EMPTY_INCOME_FORM: IncomeForm = {
  client_id: '',
  amount: '',
  type: 'received',
  date: '',
  description: '',
}

const EMPTY_EXPENSE_FORM: ExpenseForm = {
  description: '',
  amount: '',
  category: '',
  customCategory: '',
  date: todayStr(),
  recurring: false,
  recurring_day: '',
  client_id: '',
}

function isSuggestedCategory(category: string | null): boolean {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(category ?? '')
}

export default function CashFlow({ transactions: initialTransactions, expenses: initialExpenses, clients }: CashFlowProps) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const bulk = useBulkSelection()

  const [transactions, setTransactions] = useState<TransactionWithClient[]>(initialTransactions)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)

  // Filtros
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [periodShortcut, setPeriodShortcut] = useState<PeriodShortcut>('this_month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [clientFilter, setClientFilter] = useState('')

  // Novo lançamento
  const [showAddModal, setShowAddModal] = useState(false)
  const [addKind, setAddKind] = useState<EntryKind>('income')
  const [incomeForm, setIncomeForm] = useState<IncomeForm>(EMPTY_INCOME_FORM)
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(EMPTY_EXPENSE_FORM)
  const [addSaving, setAddSaving] = useState(false)

  // Edição
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [editIncomeForm, setEditIncomeForm] = useState<IncomeForm>(EMPTY_INCOME_FORM)
  const [editExpenseForm, setEditExpenseForm] = useState<ExpenseForm>(EMPTY_EXPENSE_FORM)
  const [editSaving, setEditSaving] = useState(false)

  // Import
  const [showImportPicker, setShowImportPicker] = useState(false)
  const [showImportIncomeModal, setShowImportIncomeModal] = useState(false)
  const [showImportExpenseModal, setShowImportExpenseModal] = useState(false)

  // Gráficos
  const [showCharts, setShowCharts] = useState(true)

  // --- Normalização ---
  const entries: Entry[] = useMemo(() => {
    const incomeEntries: Entry[] = transactions.map((t) => ({
      id: t.id,
      kind: 'income',
      date: t.date,
      description: t.description ?? 'Receita',
      detail: t.clients?.name ?? 'Cliente desconhecido',
      amount: t.amount,
      status: t.type,
      clientId: t.client_id,
      raw: t,
    }))
    const expenseEntries: Entry[] = expenses.map((e) => {
      const client = e.client_id ? clients.find((c) => c.id === e.client_id) : null
      const detail = client ? `${e.category ?? 'Sem categoria'} · ${client.name}` : (e.category ?? 'Sem categoria')
      return {
        id: e.id,
        kind: 'expense',
        date: e.date,
        description: e.description,
        detail,
        amount: e.amount,
        clientId: e.client_id,
        raw: e,
      }
    })
    return [...incomeEntries, ...expenseEntries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [transactions, expenses, clients])

  // --- Filtros aplicados ---
  const { from: shortcutFrom, to: shortcutTo } = periodRange(periodShortcut)
  const effectiveFrom = dateFrom || shortcutFrom
  const effectiveTo = dateTo || shortcutTo

  const filteredEntries = useMemo(() => {
    const term = normalizeText(search)
    return entries.filter((entry) => {
      if (typeFilter === 'income' && entry.kind !== 'income') return false
      if (typeFilter === 'expense' && entry.kind !== 'expense') return false
      if (clientFilter && entry.clientId !== clientFilter) return false
      if (effectiveFrom && entry.date < effectiveFrom) return false
      if (effectiveTo && entry.date > effectiveTo) return false
      if (term) {
        const haystack = normalizeText(`${entry.description} ${entry.detail}`)
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [entries, typeFilter, clientFilter, effectiveFrom, effectiveTo, search])

  // --- Resumo ---
  const totalReceived = filteredEntries
    .filter((e) => e.kind === 'income' && e.status === 'received')
    .reduce((sum, e) => sum + e.amount, 0)
  const totalExpenses = filteredEntries
    .filter((e) => e.kind === 'expense')
    .reduce((sum, e) => sum + e.amount, 0)
  const totalPending = filteredEntries
    .filter((e) => e.kind === 'income' && e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0)
  const balance = totalReceived - totalExpenses
  const balanceLabel = clientFilter ? 'Lucro do cliente' : 'Saldo'

  const hasActiveFilters = Boolean(search || typeFilter !== 'all' || periodShortcut !== 'this_month' || dateFrom || dateTo || clientFilter)

  function clearFilters() {
    setSearch('')
    setTypeFilter('all')
    setPeriodShortcut('this_month')
    setDateFrom('')
    setDateTo('')
    setClientFilter('')
  }

  // --- Novo lançamento ---
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (addSaving) return
    setAddSaving(true)

    if (addKind === 'income') {
      const client = clients.find((c) => c.id === incomeForm.client_id)
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: incomeForm.client_id,
          amount: parseFloat(incomeForm.amount),
          type: incomeForm.type,
          date: incomeForm.date || todayStr(),
          description: incomeForm.description || null,
        }),
      })
      if (res.ok) {
        const t = await res.json()
        setTransactions((prev) => [
          { ...t, clients: client ? { name: client.name, company: client.company } : null },
          ...prev,
        ])
        setIncomeForm(EMPTY_INCOME_FORM)
        setShowAddModal(false)
        toast('Receita registrada')
      } else {
        toast('Erro ao registrar receita', 'error')
      }
    } else {
      const recurring = expenseForm.recurring
      const recurringDay = recurring && expenseForm.recurring_day ? parseInt(expenseForm.recurring_day) : null
      const category = expenseForm.category === '__custom__'
        ? (expenseForm.customCategory.trim() || null)
        : (expenseForm.category || null)

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          category,
          date: expenseForm.date || todayStr(),
          recurring,
          recurring_day: recurringDay,
          client_id: expenseForm.client_id || null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        if (recurring) {
          toast('Despesa recorrente configurada')
        } else {
          setExpenses((prev) => [created, ...prev])
          toast('Despesa registrada')
        }
        setExpenseForm(EMPTY_EXPENSE_FORM)
        setShowAddModal(false)
      } else {
        toast('Erro ao registrar despesa', 'error')
      }
    }
    setAddSaving(false)
  }

  function openAddModal() {
    setAddKind('income')
    setIncomeForm(EMPTY_INCOME_FORM)
    setExpenseForm(EMPTY_EXPENSE_FORM)
    setShowAddModal(true)
  }

  // --- Edição ---
  function startEdit(entry: Entry) {
    setEditingEntry(entry)
    if (entry.kind === 'income') {
      const t = entry.raw as TransactionWithClient
      setEditIncomeForm({
        client_id: t.client_id,
        amount: String(t.amount),
        type: t.type,
        date: t.date,
        description: t.description ?? '',
      })
    } else {
      const exp = entry.raw as Expense
      const suggested = isSuggestedCategory(exp.category)
      setEditExpenseForm({
        description: exp.description,
        amount: String(exp.amount),
        category: exp.category ? (suggested ? exp.category : '__custom__') : '',
        customCategory: exp.category && !suggested ? exp.category : '',
        date: exp.date,
        recurring: exp.recurring,
        recurring_day: exp.recurring_day ? String(exp.recurring_day) : '',
        client_id: exp.client_id ?? '',
      })
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEntry || editSaving) return
    setEditSaving(true)

    if (editingEntry.kind === 'income') {
      const res = await fetch(`/api/transactions/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editIncomeForm.amount),
          type: editIncomeForm.type,
          date: editIncomeForm.date,
          description: editIncomeForm.description || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTransactions((prev) =>
          prev.map((t) => (t.id === editingEntry.id ? { ...t, ...updated, clients: t.clients } : t))
        )
        setEditingEntry(null)
        toast('Receita atualizada')
      } else {
        toast('Erro ao atualizar receita', 'error')
      }
    } else {
      const category = editExpenseForm.category === '__custom__'
        ? (editExpenseForm.customCategory.trim() || null)
        : (editExpenseForm.category || null)

      const res = await fetch(`/api/expenses/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editExpenseForm.description,
          amount: parseFloat(editExpenseForm.amount),
          category,
          date: editExpenseForm.date,
          client_id: editExpenseForm.client_id || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setExpenses((prev) => prev.map((e) => (e.id === editingEntry.id ? { ...e, ...updated } : e)))
        setEditingEntry(null)
        toast('Despesa atualizada')
      } else {
        toast('Erro ao atualizar despesa', 'error')
      }
    }
    setEditSaving(false)
  }

  async function handleDelete(entry: Entry) {
    const ok = await confirm({
      title: entry.kind === 'income' ? 'Remover esta receita?' : 'Remover esta despesa?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return

    if (entry.kind === 'income') {
      setTransactions((prev) => prev.filter((t) => t.id !== entry.id))
      await fetch(`/api/transactions/${entry.id}`, { method: 'DELETE' })
      toast('Receita removida')
    } else {
      setExpenses((prev) => prev.filter((e) => e.id !== entry.id))
      await fetch(`/api/expenses/${entry.id}`, { method: 'DELETE' })
      toast('Despesa removida')
    }
    setEditingEntry(null)
  }

  // --- Ações em massa ---
  async function bulkDelete() {
    const ids = Array.from(bulk.selected)
    if (ids.length === 0) return
    const ok = await confirm({
      title: `Remover ${ids.length} lançamento(s)?`,
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return

    const idSet = new Set(ids)
    const incomeIds = transactions.filter((t) => idSet.has(t.id)).map((t) => t.id)
    const expenseIds = expenses.filter((e) => idSet.has(e.id)).map((e) => e.id)

    setTransactions((prev) => prev.filter((t) => !idSet.has(t.id)))
    setExpenses((prev) => prev.filter((e) => !idSet.has(e.id)))

    const [incomeResult, expenseResult] = await Promise.all([
      bulkRun(incomeIds, (id) => fetch(`/api/transactions/${id}`, { method: 'DELETE' })),
      bulkRun(expenseIds, (id) => fetch(`/api/expenses/${id}`, { method: 'DELETE' })),
    ])
    const fail = incomeResult.fail + expenseResult.fail
    if (fail > 0) toast(`${fail} lançamento(s) não puderam ser removidos`, 'error')
    else toast(`${ids.length} lançamento(s) removido(s)`)
    bulk.clear()
  }

  // --- Import ---
  function mapAndValidateTransactionRow(
    raw: Record<string, unknown>
  ): { row?: TransactionImportRow; error?: string } {
    const clientName = String(getCell(raw, 'Cliente') ?? '').trim()
    if (!clientName) return { error: 'Cliente vazio' }

    const client = clients.find(
      (c) => c.name.trim().toLowerCase() === clientName.toLowerCase()
    )
    if (!client) return { error: 'Cliente não encontrado' }

    const amount = parseAmount(getCell(raw, 'Valor'))
    if (amount === null) return { error: 'Valor inválido' }

    const date = parseSheetDate(getCell(raw, 'Data'))
    if (!date) return { error: 'Data inválida' }

    const statusRaw = String(getCell(raw, 'Status') ?? '').trim().toLowerCase()
    let type: TransactionType = 'received'
    if (statusRaw === 'pendente') type = 'pending'
    else if (statusRaw === 'recebido' || statusRaw === '') type = 'received'
    else return { error: 'Status inválido (use "recebido" ou "pendente")' }

    const descriptionRaw = getCell(raw, 'Descrição')
    const description = descriptionRaw !== undefined && descriptionRaw !== null && String(descriptionRaw).trim() !== ''
      ? String(descriptionRaw).trim()
      : null

    return { row: { client_id: client.id, amount, type, date, description } }
  }

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

    const clientNameRaw = getCell(raw, 'Cliente')
    const clientName = clientNameRaw !== undefined && clientNameRaw !== null ? String(clientNameRaw).trim() : ''
    let client_id: string | null = null
    if (clientName) {
      const client = clients.find((c) => c.name.trim().toLowerCase() === clientName.toLowerCase())
      if (!client) return { error: 'Cliente não encontrado' }
      client_id = client.id
    }

    return { row: { description, amount, category, date, client_id } }
  }

  async function handleImportTransactions(rows: TransactionImportRow[]): Promise<{ inserted: number; failed: number }> {
    const res = await fetch('/api/transactions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    if (!res.ok) return { inserted: 0, failed: rows.length }
    return res.json()
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

  async function handleImportTransactionsDone() {
    const res = await fetch('/api/transactions')
    if (res.ok) {
      const data: (Transaction & { client_id: string })[] = await res.json()
      setTransactions(
        data.map((t) => {
          const client = clients.find((c) => c.id === t.client_id)
          return {
            ...t,
            clients: client ? { name: client.name, company: client.company } : null,
          }
        })
      )
    }
  }

  async function handleImportExpensesDone() {
    const res = await fetch('/api/expenses?recurring=false')
    if (res.ok) {
      const data = await res.json()
      setExpenses(data)
    }
  }

  const PERIOD_OPTIONS: { value: PeriodShortcut; label: string }[] = [
    { value: 'this_month', label: 'Este mês' },
    { value: 'last_month', label: 'Mês passado' },
    { value: 'this_year', label: 'Este ano' },
    { value: 'all', label: 'Tudo' },
  ]

  return (
    <div>
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Receitas</p>
          <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalReceived)}</p>
          {totalPending > 0 && (
            <p className="text-amber-400 text-xs mt-1">A receber: {formatCurrency(totalPending)}</p>
          )}
        </div>
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Despesas</p>
          <p className="text-red-400 text-lg font-bold">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{balanceLabel}</p>
          <p className={`text-lg font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(balance)}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="mb-6">
        <button
          onClick={() => setShowCharts((v) => !v)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors mb-3"
        >
          {showCharts ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showCharts ? 'Ocultar gráficos' : 'Mostrar gráficos'}
        </button>
        {showCharts && <CashFlowCharts entries={filteredEntries} />}
      </div>

      {/* Cabeçalho + ações */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
          Fluxo de caixa ({filteredEntries.length})
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportPicker(true)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <Upload size={14} />
            Importar Excel
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            <Plus size={14} />
            Novo lançamento
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descrição, cliente, categoria..."
            className="bg-[#1a1a1d] border border-slate-700 text-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm w-64 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-1 bg-[#1a1a1d] border border-slate-700 rounded-lg p-0.5">
          {([
            { value: 'all', label: 'Tudo' },
            { value: 'income', label: 'Entradas' },
            { value: 'expense', label: 'Saídas' },
          ] as { value: TypeFilter; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                typeFilter === opt.value
                  ? 'bg-indigo-600 text-[#050505] font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-[#1a1a1d] border border-slate-700 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setPeriodShortcut(opt.value); setDateFrom(''); setDateTo('') }}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${
                periodShortcut === opt.value && !dateFrom && !dateTo
                  ? 'bg-indigo-600 text-[#050505] font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <label>De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#1a1a1d] border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
          />
          <label>Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#1a1a1d] border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="bg-[#1a1a1d] border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
        >
          <option value="">Cliente: todos</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.company ? ` — ${c.company}` : ''}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-slate-500 hover:text-slate-300 text-sm px-2 transition-colors"
          >
            Limpar filtros ×
          </button>
        )}
      </div>

      <BulkActionBar count={bulk.count} onClear={bulk.clear}>
        <button
          onClick={bulkDelete}
          className="border border-red-800/60 text-red-400 hover:text-red-300 rounded-md px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
        >
          <Trash2 size={13} />
          Excluir
        </button>
      </BulkActionBar>

      {filteredEntries.length > 0 && (
        <label className="flex items-center gap-2 mb-2 text-xs text-slate-500 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={bulk.allSelected(filteredEntries.map((e) => e.id))}
            onChange={() => bulk.toggleAll(filteredEntries.map((e) => e.id))}
            className="w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          Selecionar todos
        </label>
      )}

      {/* Lista */}
      {entries.length === 0 ? (
        <EmptyState
          icon="💰"
          title="Nenhum lançamento ainda"
          description="Registre a primeira receita ou despesa para acompanhar o fluxo de caixa."
          action={{ label: 'Novo lançamento', onClick: openAddModal }}
        />
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          Nenhum lançamento com os filtros aplicados.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry) => {
            const isIncome = entry.kind === 'income'
            return (
              <div
                key={`${entry.kind}-${entry.id}`}
                onClick={() => startEdit(entry)}
                className="flex items-center justify-between bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:border-slate-500 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={bulk.isSelected(entry.id)}
                    onChange={() => bulk.toggle(entry.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    aria-label="Selecionar lançamento"
                  />
                  {isIncome ? (
                    <ArrowDownLeft size={16} className="text-emerald-400 flex-shrink-0" />
                  ) : (
                    <ArrowUpRight size={16} className="text-red-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{entry.description}</p>
                    <p className="text-slate-500 text-xs mt-0.5 truncate">
                      {entry.detail} · {formatDate(entry.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {entry.status === 'pending' && <Badge variant="yellow">Pendente</Badge>}
                  <p className={`text-sm font-mono font-medium ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isIncome ? '+ ' : '- '}{formatCurrency(entry.amount)}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(entry) }}
                    className="text-slate-600 hover:text-red-400 transition-colors ml-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: novo lançamento */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Novo lançamento">
        <div className="space-y-4">
          <div className="flex gap-1 bg-[#050505] border border-slate-700 rounded-lg p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setAddKind('income')}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                addKind === 'income'
                  ? 'bg-emerald-600 text-[#050505] font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setAddKind('expense')}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                addKind === 'expense'
                  ? 'bg-red-600 text-[#050505] font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Saída
            </button>
          </div>

          {addKind === 'income' ? (
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Cliente *</label>
                <select
                  required
                  value={incomeForm.client_id}
                  onChange={(e) => setIncomeForm((p) => ({ ...p, client_id: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
                    value={incomeForm.amount}
                    onChange={(e) => setIncomeForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                  <select
                    value={incomeForm.type}
                    onChange={(e) => setIncomeForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
                    className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="received">Recebido</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                  <input
                    type="date"
                    value={incomeForm.date}
                    onChange={(e) => setIncomeForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                  <input
                    type="text"
                    value={incomeForm.description}
                    onChange={(e) => setIncomeForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Ex: Mensalidade junho"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
          ) : (
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Descrição *</label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Ex: Aluguel do escritório"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Categoria</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Sem categoria</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__custom__">Outra (digitar)...</option>
                  </select>
                  {expenseForm.category === '__custom__' && (
                    <input
                      type="text"
                      value={expenseForm.customCategory}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, customCategory: e.target.value }))}
                      className="w-full mt-2 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="Nome da categoria"
                    />
                  )}
                </div>
                {!expenseForm.recurring && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                    <input
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                      className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={expenseForm.recurring}
                      onChange={(e) => setExpenseForm((p) => ({ ...p, recurring: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    Recorrente todo mês
                  </label>
                  {expenseForm.recurring && (
                    <div className="mt-2">
                      <label className="block text-xs text-slate-400 mb-1.5">Dia do mês (1–31)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={expenseForm.recurring_day}
                        onChange={(e) => setExpenseForm((p) => ({ ...p, recurring_day: e.target.value }))}
                        className="w-24 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        placeholder="Ex: 5"
                      />
                      <p className="text-slate-500 text-xs mt-1.5">
                        Será criado um template; o cron diário gera 1 lançamento por mês neste dia.
                      </p>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1.5">Cliente (opcional)</label>
                  <select
                    value={expenseForm.client_id}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, client_id: e.target.value }))}
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
                  onClick={() => setShowAddModal(false)}
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
        </div>
      </Modal>

      {/* Modal: editar lançamento */}
      <Modal
        isOpen={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
        title={editingEntry?.kind === 'income' ? 'Editar receita' : 'Editar despesa'}
      >
        {editingEntry?.kind === 'income' ? (
          <form onSubmit={handleEditSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={editIncomeForm.amount}
                  onChange={(e) => setEditIncomeForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                <select
                  value={editIncomeForm.type}
                  onChange={(e) => setEditIncomeForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
                  value={editIncomeForm.date}
                  onChange={(e) => setEditIncomeForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                <input
                  type="text"
                  value={editIncomeForm.description}
                  onChange={(e) => setEditIncomeForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => editingEntry && handleDelete(editingEntry)}
                className="text-red-500 hover:text-red-400 border border-red-900/40 hover:border-red-800/60 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
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
        ) : editingEntry?.kind === 'expense' ? (
          <form onSubmit={handleEditSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5">Descrição *</label>
                <input
                  type="text"
                  required
                  value={editExpenseForm.description}
                  onChange={(e) => setEditExpenseForm((p) => ({ ...p, description: e.target.value }))}
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
                  value={editExpenseForm.amount}
                  onChange={(e) => setEditExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                <input
                  type="date"
                  required
                  value={editExpenseForm.date}
                  onChange={(e) => setEditExpenseForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5">Categoria</label>
                <select
                  value={editExpenseForm.category}
                  onChange={(e) => setEditExpenseForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sem categoria</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__custom__">Outra (digitar)...</option>
                </select>
                {editExpenseForm.category === '__custom__' && (
                  <input
                    type="text"
                    value={editExpenseForm.customCategory}
                    onChange={(e) => setEditExpenseForm((p) => ({ ...p, customCategory: e.target.value }))}
                    className="w-full mt-2 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Nome da categoria"
                  />
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1.5">Cliente (opcional)</label>
                <select
                  value={editExpenseForm.client_id}
                  onChange={(e) => setEditExpenseForm((p) => ({ ...p, client_id: e.target.value }))}
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
                onClick={() => editingEntry && handleDelete(editingEntry)}
                className="text-red-500 hover:text-red-400 border border-red-900/40 hover:border-red-800/60 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
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
        ) : null}
      </Modal>

      {/* Modal: escolher tipo de import */}
      <Modal isOpen={showImportPicker} onClose={() => setShowImportPicker(false)} title="Importar Excel" size="sm">
        <div className="space-y-2">
          <button
            onClick={() => { setShowImportPicker(false); setShowImportIncomeModal(true) }}
            className="w-full flex items-center gap-2 bg-[#050505] border border-slate-700 hover:border-emerald-600 text-left rounded-lg px-4 py-3 transition-colors"
          >
            <ArrowDownLeft size={16} className="text-emerald-400" />
            <div>
              <p className="text-white text-sm font-medium">Receitas (Entradas)</p>
              <p className="text-slate-500 text-xs">Importar pagamentos de clientes</p>
            </div>
          </button>
          <button
            onClick={() => { setShowImportPicker(false); setShowImportExpenseModal(true) }}
            className="w-full flex items-center gap-2 bg-[#050505] border border-slate-700 hover:border-red-600 text-left rounded-lg px-4 py-3 transition-colors"
          >
            <ArrowUpRight size={16} className="text-red-400" />
            <div>
              <p className="text-white text-sm font-medium">Despesas (Saídas)</p>
              <p className="text-slate-500 text-xs">Importar gastos da empresa</p>
            </div>
          </button>
        </div>
      </Modal>

      <ImportSpreadsheetModal<TransactionImportRow>
        isOpen={showImportIncomeModal}
        onClose={() => setShowImportIncomeModal(false)}
        title="Importar receitas"
        columns={TRANSACTION_IMPORT_COLUMNS}
        templateRows={TRANSACTION_IMPORT_TEMPLATE}
        mapAndValidate={mapAndValidateTransactionRow}
        onImport={handleImportTransactions}
        onDone={handleImportTransactionsDone}
      />

      <ImportSpreadsheetModal<ExpenseImportRow>
        isOpen={showImportExpenseModal}
        onClose={() => setShowImportExpenseModal(false)}
        title="Importar despesas"
        columns={EXPENSE_IMPORT_COLUMNS}
        templateRows={EXPENSE_IMPORT_TEMPLATE}
        mapAndValidate={mapAndValidateExpenseRow}
        onImport={handleImportExpenses}
        onDone={handleImportExpensesDone}
      />
    </div>
  )
}
