import { createClient } from '@/lib/supabase/server'
import CashFlow from '@/components/financial/CashFlow'
import RecurringBillingPanel from '@/components/financial/RecurringBillingPanel'
import RecurringExpensesPanel from '@/components/financial/RecurringExpensesPanel'
import PageHeader from '@/components/ui/PageHeader'
import type { Client, Expense, Transaction } from '@/lib/types'

type TransactionWithClient = Transaction & {
  clients: { name: string; company: string | null } | null
}

interface BillingClient {
  id: string
  name: string
  company: string | null
  monthly_value: number
  billing_day: number | null
}

export default async function FinancialPage() {
  const supabase = await createClient()

  const [clientsRes, billingClientsRes, transactionsRes, expensesRes, recurringExpensesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .order('monthly_value', { ascending: false }),
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

  const clients = (clientsRes.data ?? []) as Client[]
  const billingClients = (billingClientsRes.data ?? []) as BillingClient[]
  const transactions = (transactionsRes.data ?? []) as TransactionWithClient[]
  const expenses = (expensesRes.data ?? []) as Expense[]
  const recurringExpenses = (recurringExpensesRes.data ?? []) as Expense[]
  const mrr = billingClients.reduce((sum, c) => sum + (c.monthly_value || 0), 0)

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Visão geral do fluxo de caixa" />

      <CashFlow
        transactions={transactions}
        expenses={expenses}
        clients={clients}
      />

      <RecurringBillingPanel clients={billingClients} mrr={mrr} />

      <RecurringExpensesPanel initialRecurringExpenses={recurringExpenses} />
    </div>
  )
}
