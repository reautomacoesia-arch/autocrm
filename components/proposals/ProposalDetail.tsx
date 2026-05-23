'use client'

import { useState } from 'react'
import type { Proposal, ProposalItem, ProposalStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { useRouter } from 'next/navigation'

const STATUS_BADGE: Record<
  ProposalStatus,
  { label: string; variant: 'gray' | 'blue' | 'green' | 'red' }
> = {
  draft: { label: 'Rascunho', variant: 'gray' },
  sent: { label: 'Enviada', variant: 'blue' },
  approved: { label: 'Aprovada', variant: 'green' },
  rejected: { label: 'Recusada', variant: 'red' },
}

const STATUS_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['sent'],
  sent: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

type ProposalWithRelations = Proposal & {
  clients: { id: string; name: string; company: string | null; email: string | null } | null
  leads: { id: string; name: string; company: string | null; email: string | null } | null
  proposal_items: (ProposalItem & { services: { name: string } | null })[]
}

interface ProposalDetailProps {
  proposal: ProposalWithRelations
}

export default function ProposalDetail({ proposal: initial }: ProposalDetailProps) {
  const [proposal, setProposal] = useState(initial)
  const [updating, setUpdating] = useState(false)
  const router = useRouter()

  const contact = proposal.clients ?? proposal.leads
  const transitions = STATUS_TRANSITIONS[proposal.status]

  async function changeStatus(status: ProposalStatus) {
    setUpdating(true)
    const res = await fetch(`/api/proposals/${proposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const updated = await res.json()
    setProposal((prev) => ({ ...prev, status: updated.status }))
    setUpdating(false)
  }

  async function deleteProposal() {
    if (!confirm('Excluir esta proposta?')) return
    await fetch(`/api/proposals/${proposal.id}`, { method: 'DELETE' })
    router.push('/proposals')
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {contact && (
              <>
                <h1 className="text-white text-xl font-bold">{contact.name}</h1>
                {contact.company && <p className="text-slate-400 text-sm">{contact.company}</p>}
                {contact.email && <p className="text-slate-500 text-xs mt-1">{contact.email}</p>}
              </>
            )}
            <p className="text-slate-500 text-xs mt-2">
              Criada em {formatDate(proposal.created_at)}
              {proposal.valid_until && ` · Válida até ${formatDate(proposal.valid_until)}`}
            </p>
          </div>
          <Badge variant={STATUS_BADGE[proposal.status].variant}>
            {STATUS_BADGE[proposal.status].label}
          </Badge>
        </div>

        {transitions.length > 0 && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
            {transitions.map((status) => (
              <button
                key={status}
                onClick={() => changeStatus(status)}
                disabled={updating}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  status === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : status === 'rejected'
                    ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {status === 'sent'
                  ? 'Marcar como Enviada'
                  : status === 'approved'
                  ? 'Aprovar ✓'
                  : 'Recusar ✗'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="mb-6">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Itens da Proposta
        </h2>
        <div className="space-y-2">
          {proposal.proposal_items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
            >
              <div>
                <p className="text-white text-sm">
                  {item.custom_description ?? item.services?.name ?? 'Item sem descrição'}
                </p>
                {item.services && item.custom_description && (
                  <p className="text-slate-500 text-xs">{item.services.name}</p>
                )}
              </div>
              <p className="text-emerald-400 text-sm font-semibold flex-shrink-0 ml-4">
                {formatCurrency(item.price)}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3 pt-3 border-t border-slate-700">
          <p className="text-white font-bold">
            Total:{' '}
            <span className="text-emerald-400">{formatCurrency(proposal.value)}</span>
          </p>
        </div>
      </div>

      {/* Notes */}
      {proposal.notes && (
        <div className="mb-6">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Observações
          </h2>
          <p className="text-slate-300 text-sm bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3">
            {proposal.notes}
          </p>
        </div>
      )}

      <button
        onClick={deleteProposal}
        className="text-slate-500 hover:text-red-400 text-sm transition-colors"
      >
        Excluir proposta
      </button>
    </div>
  )
}
