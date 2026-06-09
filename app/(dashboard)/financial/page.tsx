import { createClient } from '@/lib/supabase/server'
import TransactionManager from '@/components/financial/TransactionManager'

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
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Financeiro</h1>
        <p className="text-slate-400 text-sm mt-1">Visão geral do fluxo de caixa</p>
      </div>

      <TransactionManager
        initialTransactions={transactions as any}
        clients={clients as any}
        mrr={mrr}
      />
    </div>
  )
}
