import { createClient } from '@/lib/supabase/server'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()

  const [transactionsRes, leadsRes, proposalsRes, clientsRes, pipelineEventsRes, expensesRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, type, date')
      .order('date', { ascending: true }),
    supabase
      .from('leads')
      .select('id, stage, estimated_value, source, created_at'),
    supabase
      .from('proposals')
      .select('status, value, created_at'),
    supabase
      .from('clients')
      .select('monthly_value, status, is_internal'),
    supabase
      .from('pipeline_events')
      .select('lead_id, from_stage, to_stage, happened_at')
      .order('happened_at', { ascending: true }),
    supabase
      .from('expenses')
      .select('amount, category, date')
      .eq('recurring', false)
      .order('date', { ascending: true }),
  ])

  const transactions = (transactionsRes.data ?? []) as {
    amount: number
    type: 'received' | 'pending'
    date: string
  }[]

  const leads = (leadsRes.data ?? []) as {
    id: string
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

  const pipelineEvents = (pipelineEventsRes.data ?? []) as {
    lead_id: string
    from_stage: string
    to_stage: string
    happened_at: string
  }[]

  const expenses = (expensesRes.data ?? []) as {
    amount: number
    category: string | null
    date: string
  }[]

  const allClients = (clientsRes.data ?? []) as {
    monthly_value: number
    status: string
    is_internal: boolean
  }[]

  const activeClientsList = allClients.filter((c) => c.status === 'active' && !c.is_internal)
  const churnedClientsList = allClients.filter((c) => c.status === 'churned' && !c.is_internal)

  const mrr = activeClientsList.reduce((sum, c) => sum + (c.monthly_value ?? 0), 0)
  const activeClients = activeClientsList.length
  const churnedClients = churnedClientsList.length
  const churnedMrr = churnedClientsList.reduce((sum, c) => sum + (c.monthly_value ?? 0), 0)
  const churnRate =
    activeClients + churnedClients > 0
      ? (churnedClients / (activeClients + churnedClients)) * 100
      : 0

  return (
    <ReportsClient
      transactions={transactions}
      leads={leads}
      proposals={proposals}
      pipelineEvents={pipelineEvents}
      expenses={expenses}
      mrr={mrr}
      activeClients={activeClients}
      churnedClients={churnedClients}
      churnedMrr={churnedMrr}
      churnRate={churnRate}
    />
  )
}
