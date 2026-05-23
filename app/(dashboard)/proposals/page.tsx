import { createClient } from '@/lib/supabase/server'
import ProposalList from '@/components/proposals/ProposalList'
import type { Client, Proposal, Service } from '@/lib/types'

export default async function ProposalsPage() {
  const supabase = await createClient()

  const [proposalsRes, clientsRes, servicesRes] = await Promise.all([
    supabase
      .from('proposals')
      .select('*, clients(id, name, company), leads(id, name, company)')
      .order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name, company').eq('status', 'active').order('name'),
    supabase.from('services').select('*').order('name'),
  ])

  const proposals = (proposalsRes.data ?? []) as (Proposal & {
    clients: { id: string; name: string; company: string | null } | null
    leads: { id: string; name: string; company: string | null } | null
  })[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Propostas</h1>
        <p className="text-slate-400 text-sm mt-1">{proposals.length} proposta(s)</p>
      </div>
      <ProposalList
        proposals={proposals}
        clients={(clientsRes.data as Client[]) ?? []}
        services={(servicesRes.data as Service[]) ?? []}
      />
    </div>
  )
}
