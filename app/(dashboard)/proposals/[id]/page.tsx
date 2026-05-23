import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProposalDetail from '@/components/proposals/ProposalDetail'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProposalPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select(`
      *,
      clients(id, name, company, email),
      leads(id, name, company, email),
      proposal_items(*, services(name))
    `)
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link href="/proposals" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← Propostas
        </Link>
      </div>
      <ProposalDetail proposal={proposal as any} />
    </div>
  )
}
