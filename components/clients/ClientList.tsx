'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Client, ClientStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { Search, ChevronRight, Plus } from 'lucide-react'
import AddClientModal from './AddClientModal'
import EmptyState from '@/components/ui/EmptyState'

const STATUS_BADGE: Record<
  ClientStatus,
  { label: string; variant: 'green' | 'gray' | 'red' }
> = {
  active: { label: 'Ativo', variant: 'green' },
  inactive: { label: 'Inativo', variant: 'gray' },
  churned: { label: 'Churned', variant: 'red' },
}

interface ClientListProps {
  clients: Client[]
}

export default function ClientList({ clients: initialClients }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [search, setSearch] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function handleClientAdded(client: Client) {
    setClients((prev) => [client, ...prev])
    setIsAddModalOpen(false)
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
            className="w-full bg-[#1e293b] border border-slate-700 text-white rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={15} />
          Novo Cliente
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          {search ? (
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
          )}
        ) : (
          filtered.map((client) => {
            const badge = STATUS_BADGE[client.status]
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between bg-[#1e293b] hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 rounded-lg px-4 py-3 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 font-semibold text-sm flex-shrink-0">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{client.name}</p>
                    {client.company && (
                      <p className="text-slate-400 text-xs">{client.company}</p>
                    )}
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
