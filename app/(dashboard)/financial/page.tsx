import { createClient } from '@/lib/supabase/server'
import TransactionManager from '@/components/financial/TransactionManager'
import ExpensesSection from '@/components/financial/ExpensesSection'
import PageHeader from '@/components/ui/PageHeader'
import type { Expense } from '@/lib/types'

export default async function FinancialPage() {
  const supabase = await createClient()

  const [clientsRes, transactionsRes, expensesRes, recurringExpensesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, company, monthly_value, billing_day')
      .eq('status', 'active')
      .eq('is_internal', false)
      .order('monthly_value', { ascending: false }),
    supabase
      .from('transactions')
      .select('*, clients(name, company)')
      .order('date', { ascending: false })
      .limit(100),
    supabase
      .from('expenses')
      .select('*')
      .eq('recurring', false)
      .order('date', { ascending: false })
      .limit(100),
    supabase
      .from('expenses')
      .select('*')
      .eq('recurring', true)
      .order('created_at', { ascending: false }),
  ])

  const clients = (clientsRes.data ?? []) as {
    id: string
    name: string
    company: string | null
    monthly_value: number
    billing_day: number | null
  }[]
  const transactions = transactionsRes.data ?? []
  const expenses = (expensesRes.data ?? []) as Expense[]
  const recurringExpenses = (recurringExpensesRes.data ?? []) as Expense[]
  const mrr = clients.reduce((sum: number, c: any) => sum + (c.monthly_value || 0), 0)

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Visão geral do fluxo de caixa" />

      <TransactionManager
        initialTransactions={transactions as any}
        clients={clients as any}
        mrr={mrr}
      />

      <ExpensesSection
        initialExpenses={expenses}
        initialRecurringExpenses={recurringExpenses}
      />
    </div>
  )
}
