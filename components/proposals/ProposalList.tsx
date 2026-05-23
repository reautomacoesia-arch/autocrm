'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Client, Proposal, ProposalStatus, Service } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import CreateProposalModal from './CreateProposalModal'
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

type ProposalWithRelations = Proposal & {
  clients: { id: string; name: string; company: string | null } | null
  leads: { id: string; name: string; company: string | null } | null
}

interface ProposalListProps {
  proposals: ProposalWithRelations[]
  clients: Client[]
  services: Service[]
}

export default function ProposalList({ proposals: initial, clients, services }: ProposalListProps) {
  const [proposals] = useState<ProposalWithRelations[]>(initial)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all')

  const filtered = filter === 'all' ? proposals : proposals.filter((p) => p.status === filter)

  function getContactName(p: ProposalWithRelations): string {
    if (p.clients) return p.clients.company ? `${p.clients.name} — ${p.clients.company}` : p.clients.name
    if (p.leads) return p.leads.company ? `${p.leads.name} — ${p.leads.company}` : p.leads.name
    return 'Sem cliente'
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'draft', 'sent', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all'
                ? `Todas (${proposals.length})`
                : STATUS_BADGE[f as ProposalStatus].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nova Proposta
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {filter === 'all'
              ? 'Nenhuma proposta criada ainda.'
              : `Nenhuma proposta "${STATUS_BADGE[filter as ProposalStatus].label}".`}
          </div>
        ) : (
          filtered.map((proposal) => {
            const badge = STATUS_BADGE[proposal.status]
            return (
              <Link
                key={proposal.id}
                href={`/proposals/${proposal.id}`}
                className="flex items-center justify-between bg-[#1e293b] hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 rounded-lg px-4 py-3 transition-colors group"
              >
                <div>
                  <p className="text-white text-sm font-medium">{getContactName(proposal)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatDate(proposal.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 text-sm font-semibold hidden sm:block">
                    {formatCurrency(proposal.value)}
                  </span>
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
        clients={clients}
        services={services}
      />
    </>
  )
}
