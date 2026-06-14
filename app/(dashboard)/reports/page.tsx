import { createClient } from '@/lib/supabase/server'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()

  const [transactionsRes, leadsRes, proposalsRes, clientsRes, pipelineEventsRes, expensesRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, type, date, description, clients(name)')
      .order('date', { ascending: true }),
    supabase
      .from('leads')
      .select('id, name, company, stage, estimated_value, source, created_at'),
    supabase
      .from('proposals')
      .select('status, value, created_at, clients(name), leads(name)'),
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

  // Supabase retorna joins como objeto ou array dependendo da relação inferida.
  type RelatedName = { name: string | null } | { name: string | null }[] | null
  function relatedName(rel: RelatedName): string | null {
    if (!rel) return null
    if (Array.isArray(rel)) return rel[0]?.name ?? null
    return rel.name ?? null
  }

  const rawTransactions = (transactionsRes.data ?? []) as {
    amount: number
    type: 'received' | 'pending'
    date: string
    description: string | null
    clients: RelatedName
  }[]

  const transactions = rawTransactions.map((t) => ({
    amount: t.amount,
    type: t.type,
    date: t.date,
    description: t.description,
    client_name: relatedName(t.clients),
  }))

  const leads = (leadsRes.data ?? []) as {
    id: string
    name: string
    company: string | null
    stage: string
    estimated_value: number
    source: string | null
    created_at: string
  }[]

  const rawProposals = (proposalsRes.data ?? []) as {
    status: string
    value: number
    created_at: string
    clients: RelatedName
    leads: RelatedName
  }[]

  const proposals = rawProposals.map((p) => ({
    status: p.status,
    value: p.value,
    created_at: p.created_at,
    client_name: relatedName(p.clients),
    lead_name: relatedName(p.leads),
  }))

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
