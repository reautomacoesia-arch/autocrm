'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Client, ClientStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, ChevronRight, Download, Plus, Search, ChevronDown, Trash2, Flag } from 'lucide-react'
import AddClientModal from './AddClientModal'
import EmptyState from '@/components/ui/EmptyState'
import { exportToExcel } from '@/lib/export-excel'
import { useBulkSelection } from '@/lib/hooks/useBulkSelection'
import BulkActionBar from '@/components/ui/BulkActionBar'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

const STATUS_BADGE: Record<
  ClientStatus,
  { label: string; variant: 'green' | 'gray' | 'red' }
> = {
  active: { label: 'Ativo', variant: 'green' },
  inactive: { label: 'Inativo', variant: 'gray' },
  churned: { label: 'Churned', variant: 'red' },
}

function daysAgo(isoStr: string): number {
  const then = new Date(isoStr).setHours(0, 0, 0, 0)
  const now = new Date().setHours(0, 0, 0, 0)
  return Math.floor((now - then) / 86_400_000)
}

function lastContactLabel(isoStr: string | undefined): { text: string; alert: boolean } {
  if (!isoStr) return { text: 'sem contato registrado', alert: false }
  const days = daysAgo(isoStr)
  if (days === 0) return { text: 'contato hoje', alert: false }
  if (days === 1) return { text: 'último contato ontem', alert: false }
  const alert = days > 30
  return { text: `último contato há ${days} dias`, alert }
}

interface ClientListProps {
  clients: Client[]
  lastInteractions?: Record<string, string>
}

export default function ClientList({ clients: initialClients, lastInteractions = {} }: ClientListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [search, setSearch] = useState('')
  // Auto-abre o modal de criação quando a URL tem ?new=1 (ex.: launcher de comandos)
  const [isAddModalOpen, setIsAddModalOpen] = useState(() => searchParams.get('new') === '1')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'churned'>('all')
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'mrr' | 'lastContact'>('default')
  const { toast } = useToast()
  const confirm = useConfirm()
  const bulk = useBulkSelection()
  const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false)

  // Limpa o ?new=1 da URL para não reabrir o modal em navegações futuras
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      router.replace('/clients')
    }
  }, [searchParams, router])

  // Separa empresa interna dos clientes reais
  const internalClients = clients.filter((c) => c.is_internal)
  const externalClients = clients.filter((c) => !c.is_internal)

  const filtered = externalClients
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.company ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .filter((c) => filterStatus === 'all' || c.status === filterStatus)

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    if (sortBy === 'mrr') return b.monthly_value - a.monthly_value
    if (sortBy === 'lastContact') {
      const aDate = lastInteractions[a.id] ?? ''
      const bDate = lastInteractions[b.id] ?? ''
      return bDate.localeCompare(aDate)
    }
    return 0
  })

  function handleClientAdded(client: Client) {
    setClients((prev) => [client, ...prev])
    setIsAddModalOpen(false)
  }

  function handleExport() {
    exportToExcel(
      'clientes',
      sorted.map((c) => ({
        Nome: c.name,
        Empresa: c.company ?? '',
        'E-mail': c.email ?? '',
        Telefone: c.phone ?? '',
        Status: STATUS_BADGE[c.status].label,
        MRR: c.monthly_value,
        Início: c.started_at ? new Date(c.started_at).toLocaleDateString('pt-BR') : '',
      })),
      'Clientes',
    )
  }

  async function bulkSetStatus(status: ClientStatus) {
    const ids = Array.from(bulk.selected)
    if (ids.length === 0) return
    setShowBulkStatusMenu(false)
    setClients((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, status } : c)))
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/clients/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }),
      ),
    )
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) toast(`${failed} cliente(s) não puderam ser atualizados`, 'error')
    else toast(`Status de ${ids.length} cliente(s) atualizado para ${STATUS_BADGE[status].label}`)
    bulk.clear()
  }

  async function bulkDelete() {
    const ids = Array.from(bulk.selected)
    if (ids.length === 0) return
    const ok = await confirm({
      title: `Remover ${ids.length} cliente${ids.length !== 1 ? 's' : ''}?`,
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setClients((prev) => prev.filter((c) => !ids.includes(c.id)))
    const results = await Promise.all(ids.map((id) => fetch(`/api/clients/${id}`, { method: 'DELETE' })))
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) toast(`${failed} cliente(s) não puderam ser removidos`, 'error')
    else toast(`${ids.length} cliente(s) removido(s)`)
    bulk.clear()
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou empresa..."
            className="w-full bg-[#1a1a1d] border border-slate-700 text-white rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={handleExport}
          disabled={sorted.length === 0}
          className="flex items-center gap-1.5 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-xs transition-colors whitespace-nowrap"
        >
          <Download size={13} />
          Exportar Excel
        </button>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={15} />
          Novo Cliente
        </button>
      </div>

      {/* C1+C2 — Filtro de status + ordenação */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'active', 'inactive', 'churned'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filterStatus === s
                  ? 'bg-indigo-600 text-[#050505]'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s === 'all' ? `Todos (${externalClients.length})` : STATUS_BADGE[s as ClientStatus].label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-[#1a1a1d] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
        >
          <option value="default">Padrão (mais recente)</option>
          <option value="name">Nome A→Z</option>
          <option value="mrr">MRR (maior)</option>
          <option value="lastContact">Último contato</option>
        </select>
      </div>

      {/* Nossa empresa — seção separada, não conta como cliente */}
      {internalClients.length > 0 && (
        <div className="mb-5">
          <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
            <Building2 size={11} /> Nossa empresa
          </p>
          {internalClients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between bg-indigo-950/30 hover:bg-indigo-900/20 border border-indigo-900/50 hover:border-indigo-700/50 rounded-lg px-4 py-3 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600/30 rounded-full flex items-center justify-center text-indigo-300 font-bold text-sm flex-shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-indigo-200 text-sm font-medium">{client.name}</p>
                    <span className="text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-700/50 px-1.5 py-0.5 rounded-full font-medium">
                      Nossa empresa
                    </span>
                  </div>
                  {client.company && <p className="text-slate-500 text-xs">{client.company}</p>}
                </div>
              </div>
              <ChevronRight size={14} className="text-indigo-700 group-hover:text-indigo-400 transition-colors" />
            </Link>
          ))}
        </div>
      )}

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
              {(['active', 'inactive', 'churned'] as ClientStatus[]).map((s) => (
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

      {sorted.length > 0 && (
        <label className="flex items-center gap-2 mb-2 text-xs text-slate-500 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={bulk.allSelected(sorted.map((c) => c.id))}
            onChange={() => bulk.toggleAll(sorted.map((c) => c.id))}
            className="w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          Selecionar todos
        </label>
      )}

      <div className="space-y-2">
        {sorted.length === 0 ? (
          search || filterStatus !== 'all' ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Nenhum cliente encontrado.
            </div>
          ) : (
            <EmptyState
              icon="👥"
              title="Nenhum cliente ainda"
              description="Adicione seu primeiro cliente para organizar projetos e receitas."
              action={{ label: '+ Novo Cliente', onClick: () => setIsAddModalOpen(true) }}
            />
          )
        ) : (
          sorted.map((client) => {
            const badge = STATUS_BADGE[client.status]
            const { text: contactText, alert: contactAlert } = lastContactLabel(lastInteractions[client.id])
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className={`flex items-center justify-between bg-[#1a1a1d] hover:bg-slate-700/50 border rounded-lg px-4 py-3 transition-colors group ${
                  contactAlert
                    ? 'border-red-800 hover:border-red-700'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={bulk.isSelected(client.id)}
                    onChange={() => {}}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); bulk.toggle(client.id) }}
                    className="flex-shrink-0 w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    aria-label="Selecionar cliente"
                  />
                  <div className="w-9 h-9 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 font-semibold text-sm flex-shrink-0">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{client.name}</p>
                    <p className="text-slate-400 text-xs">
                      {client.company && <span>{client.company}</span>}
                      {client.company && ' · '}
                      <span className={contactAlert ? 'text-red-400' : 'text-slate-500'}>
                        {contactText}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {client.monthly_value > 0 && (
                    <span className="text-emerald-400 text-sm font-medium hidden sm:block">
                      {formatCurrency(client.monthly_value)}/mês
                    </span>
                  )}
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <ChevronRight
                    size={14}
                    className="text-slate-500 group-hover:text-slate-300 transition-colors"
                  />
                </div>
              </Link>
            )
          })
        )}
      </div>

      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onClientAdded={handleClientAdded}
      />
    </div>
  )
}
