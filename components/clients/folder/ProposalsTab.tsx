'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Proposal, ProposalStatus, Service } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import CreateProposalModal from '@/components/proposals/CreateProposalModal'
import { formatCurrency } from '@/lib/pipeline'
import { Plus, ChevronRight } from 'lucide-react'

const STATUS_BADGE: Record<
  ProposalStatus,
  { label: string; variant: 'gray' | 'blue' | 'green' | 'red' }
> = {
  draft: { label: 'Rascunho', variant: 'gray' },
  sent: { label: 'Enviada', variant: 'blue' },
  approved: { label: 'Aprovada', variant: 'green' },
  rejected: { label: 'Recusada', variant: 'red' },
}

interface ProposalsTabProps {
  clientId: string
  clientName: string
}

export default function ProposalsTab({ clientId, clientName }: ProposalsTabProps) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/proposals?client_id=${clientId}`).then((r) => r.json()),
      fetch('/api/services').then((r) => r.json()),
    ]).then(([proposalsData, servicesData]) => {
      setProposals(proposalsData ?? [])
      setServices(servicesData ?? [])
      setLoading(false)
    })
  }, [clientId])

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-400 text-sm">{proposals.length} proposta(s)</p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          <Plus size={14} />
          Nova proposta
        </button>
      </div>

      <div className="space-y-2">
        {proposals.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhuma proposta para este cliente.
          </div>
        ) : (
          proposals.map((proposal) => {
            const badge = STATUS_BADGE[proposal.status]
            return (
              <Link
                key={proposal.id}
                href={`/proposals/${proposal.id}`}
                className="flex items-center justify-between bg-[#1e293b] hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 rounded-lg px-4 py-3 transition-colors group"
              >
                <div>
                  <p className="text-white text-sm font-medium">
                    {formatCurrency(proposal.value)}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatDate(proposal.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <ChevronRight
                    size={14}
                    className="text-slate-500 group-hover:text-slate-300"
                  />
                </div>
              </Link>
            )
          })
        )}
      </div>

      <CreateProposalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clients={[{ id: clientId, name: clientName } as any]}
        services={services}
        defaultClientId={clientId}
      />
    </div>
  )
}
