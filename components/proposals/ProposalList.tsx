'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Client, Lead, Proposal, ProposalStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import GenerateProposalModal from './GenerateProposalModal'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/pipeline'
import { Plus, ChevronRight, Download, ChevronDown, Trash2, Flag } from 'lucide-react'
import { exportToExcel } from '@/lib/export-excel'
import { useBulkSelection } from '@/lib/hooks/useBulkSelection'
import BulkActionBar from '@/components/ui/BulkActionBar'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

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
  const [proposals, setProposals] = useState<ProposalWithRelations[]>(initial)
  // Auto-abre o modal de nova proposta quando a URL tem ?new=1 (ex.: launcher de comandos)
  const [isModalOpen, setIsModalOpen] = useState(() => searchParams.get('new') === '1')
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all')
  const { toast } = useToast()
  const confirm = useConfirm()
  const bulk = useBulkSelection()
  const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false)

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

  function handleExport() {
    exportToExcel(
      'propostas',
      filtered.map((p) => ({
        'Cliente/Lead': getContactName(p),
        Valor: p.value,
        Status: STATUS_BADGE[p.status].label,
        'Criada em': formatDate(p.created_at),
        'Válida até': p.valid_until ? formatDate(p.valid_until) : '',
        'Gerada por IA': p.external_id ? 'Sim' : 'Não',
        Link: p.external_url ?? '',
      })),
      'Propostas',
    )
  }

  async function bulkSetStatus(status: ProposalStatus) {
    const ids = Array.from(bulk.selected)
    if (ids.length === 0) return
    setShowBulkStatusMenu(false)
    setProposals((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, status } : p)))
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/proposals/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }),
      ),
    )
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) toast(`${failed} proposta(s) não puderam ser atualizadas`, 'error')
    else toast(`Status de ${ids.length} proposta(s) atualizado para ${STATUS_BADGE[status].label}`)
    bulk.clear()
  }

  async function bulkDelete() {
    const ids = Array.from(bulk.selected)
    if (ids.length === 0) return
    const ok = await confirm({
      title: `Remover ${ids.length} proposta${ids.length !== 1 ? 's' : ''}?`,
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setProposals((prev) => prev.filter((p) => !ids.includes(p.id)))
    const results = await Promise.all(ids.map((id) => fetch(`/api/proposals/${id}`, { method: 'DELETE' })))
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) toast(`${failed} proposta(s) não puderam ser removidas`, 'error')
    else toast(`${ids.length} proposta(s) removida(s)`)
    bulk.clear()
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-xs transition-colors whitespace-nowrap"
          >
            <Download size={13} />
            Exportar Excel
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Nova Proposta
          </button>
        </div>
      </div>

      <BulkActionBar count={bulk.count} onClear={bulk.clear}>
        <div className="relative">
          <button
            onClick={() => setShowBulkStatusMenu((v) => !v)}
            className="border border-slate-700 text-slate-300 hover:text-white rounded-md px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
          >
            <Flag size={13} />
            Mudar status
            <ChevronDown size={12} />
          </button>
          {showBulkStatusMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1d] border border-slate-700 rounded-md shadow-lg z-10 min-w-[120px] overflow-hidden">
              {(['draft', 'sent', 'approved', 'rejected'] as ProposalStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => bulkSetStatus(s)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                >
                  {STATUS_BADGE[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={bulkDelete}
          className="border border-red-800/60 text-red-400 hover:text-red-300 rounded-md px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
        >
          <Trash2 size={13} />
          Excluir
        </button>
      </BulkActionBar>

      {filtered.length > 0 && (
        <label className="flex items-center gap-2 mb-2 text-xs text-slate-500 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={bulk.allSelected(filtered.map((p) => p.id))}
            onChange={() => bulk.toggleAll(filtered.map((p) => p.id))}
            className="w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          Selecionar todos
        </label>
      )}

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
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={bulk.isSelected(proposal.id)}
                    onChange={() => {}}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); bulk.toggle(proposal.id) }}
                    className="flex-shrink-0 w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    aria-label="Selecionar proposta"
                  />
                  <div>
                    <p className="text-white text-sm font-medium">{getContactName(proposal)}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{formatDate(proposal.created_at)}</p>
                  </div>
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
