import { createClient } from '@/lib/supabase/server'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()

  const [transactionsRes, leadsRes, proposalsRes, clientsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, type, date')
      .order('date', { ascending: true }),
    supabase
      .from('leads')
      .select('stage, estimated_value, source, created_at'),
    supabase
      .from('proposals')
      .select('status, value, created_at'),
    supabase
      .from('clients')
      .select('monthly_value')
      .eq('status', 'active'),
  ])

  const transactions = (transactionsRes.data ?? []) as {
    amount: number
    type: 'received' | 'pending'
    date: string
  }[]

  const leads = (leadsRes.data ?? []) as {
    stage: string
    estimated_value: number
    source: string | null
    created_at: string
  }[]

  const proposals = (proposalsRes.data ?? []) as {
    status: string
    value: number
    created_at: string
  }[]

  const mrr = (clientsRes.data ?? []).reduce(
    (sum: number, c: any) => sum + (c.monthly_value ?? 0),
    0
  )
  const activeClients = clientsRes.data?.length ?? 0

  return (
    <ReportsClient
      transactions={transactions}
      leads={leads}
      proposals={proposals}
      mrr={mrr}
      activeClients={activeClients}
    />
  )
}
