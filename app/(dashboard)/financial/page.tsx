import { createClient } from '@/lib/supabase/server'
import TransactionManager from '@/components/financial/TransactionManager'
import PageHeader from '@/components/ui/PageHeader'

export default async function FinancialPage() {
  const supabase = await createClient()

  const [clientsRes, transactionsRes] = await Promise.all([
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
  ])

  const clients = (clientsRes.data ?? []) as {
    id: string
    name: string
    company: string | null
    monthly_value: number
    billing_day: number | null
  }[]
  const transactions = transactionsRes.data ?? []
  const mrr = clients.reduce((sum: number, c: any) => sum + (c.monthly_value || 0), 0)

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Visão geral do fluxo de caixa" />

      <TransactionManager
        initialTransactions={transactions as any}
        clients={clients as any}
        mrr={mrr}
      />
    </div>
  )
}
