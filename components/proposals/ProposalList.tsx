'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Client, Lead, Proposal, ProposalStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import GenerateProposalModal from './GenerateProposalModal'
import EmptyState from '@/components/ui/EmptyState'
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
  leads: Lead[]
}

export default function ProposalList({ proposals: initial, clients, leads }: ProposalListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [proposals] = useState<ProposalWithRelations[]>(initial)
  // Auto-abre o modal de nova proposta quando a URL tem ?new=1 (ex.: launcher de comandos)
  const [isModalOpen, setIsModalOpen] = useState(() => searchParams.get('new') === '1')
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all')

  // Limpa o ?new=1 da URL para não reabrir o modal em navegações futuras
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      router.replace('/proposals')
    }
  }, [searchParams, router])

  // PR1 — totais calculados sobre TODAS as propostas
  const totalApproved = proposals
    .filter((p) => p.status === 'approved')
    .reduce((s, p) => s + p.value, 0)
  const totalSent = proposals
    .filter((p) => p.status === 'sent')
    .reduce((s, p) => s + p.value, 0)
  const nApproved = proposals.filter((p) => p.status === 'approved').length
  const nSent = proposals.filter((p) => p.status === 'sent').length
  const nRejected = proposals.filter((p) => p.status === 'rejected').length
  const convRate =
    nApproved + nRejected > 0
      ? Math.round((nApproved / (nApproved + nRejected)) * 100)
      : null

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
      {/* PR1 — Cards de resumo */}
      {proposals.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Aprovado</p>
            <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalApproved)}</p>
            <p className="text-slate-500 text-xs mt-1">{nApproved} proposta(s)</p>
          </div>
          <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Em Negociação</p>
            <p className="text-amber-400 text-lg font-bold">{formatCurrency(totalSent)}</p>
            <p className="text-slate-500 text-xs mt-1">{nSent} proposta(s)</p>
          </div>
          <div className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Taxa de Conversão</p>
            <p className="text-white text-lg font-bold">
              {convRate !== null ? `${convRate}%` : '—'}
            </p>
            <p className="text-slate-500 text-xs mt-1">aprovadas / (apr + rec)</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'draft', 'sent', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-[#050505]'
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
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nova Proposta
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          filter === 'all' ? (
            <EmptyState
              icon="📄"
              title="Nenhuma proposta ainda"
              description="Crie uma proposta para um cliente ou lead."
              action={{ label: '+ Nova Proposta', onClick: () => setIsModalOpen(true) }}
            />
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              Nenhuma proposta "{STATUS_BADGE[filter as ProposalStatus].label}".
            </div>
          )
        ) : (
          filtered.map((proposal) => {
            const badge = STATUS_BADGE[proposal.status]
            return (
              <Link
                key={proposal.id}
                href={`/proposals/${proposal.id}`}
                className="flex items-center justify-between bg-[#1a1a1d] hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 rounded-lg px-4 py-3 transition-colors group"
              >
                <div>
                  <p className="text-white text-sm font-medium">{getContactName(proposal)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatDate(proposal.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 text-sm font-semibold hidden sm:block">
                    {formatCurrency(proposal.value)}
                  </span>
                  {proposal.external_id && (
                    <Badge variant="indigo">Gerado por IA</Badge>
                  )}
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

      <GenerateProposalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clients={clients}
        leads={leads}
      />
    </>
  )
}
