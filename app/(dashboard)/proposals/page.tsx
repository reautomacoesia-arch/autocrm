import { createClient } from '@/lib/supabase/server'
import ProposalList from '@/components/proposals/ProposalList'
import PageHeader from '@/components/ui/PageHeader'
import type { Client, Lead, Proposal } from '@/lib/types'

export default async function ProposalsPage() {
  const supabase = await createClient()

  const [proposalsRes, clientsRes, leadsRes] = await Promise.all([
    supabase
      .from('proposals')
      .select('*, clients(id, name, company), leads(id, name, company)')
      .order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name, company, email, phone').eq('status', 'active').order('name'),
    supabase.from('leads').select('id, name, company, email, phone').order('name'),
  ])

  const proposals = (proposalsRes.data ?? []) as (Proposal & {
    clients: { id: string; name: string; company: string | null } | null
    leads: { id: string; name: string; company: string | null } | null
  })[]

  return (
    <div>
      <PageHeader title="Propostas" subtitle={`${proposals.length} proposta(s)`} />
      <ProposalList
        proposals={proposals}
        clients={(clientsRes.data as Client[]) ?? []}
        leads={(leadsRes.data as Lead[]) ?? []}
      />
    </div>
  )
}
