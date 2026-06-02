'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { Client } from '@/lib/types'
import DataTab from './DataTab'
import OnboardingTab from './OnboardingTab'
import ProjectsTab from './ProjectsTab'
import HistoryTab from './HistoryTab'
import TasksTab from './TasksTab'
import ProposalsTab from './ProposalsTab'
import FinancialTab from './FinancialTab'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, DollarSign, Mail, Pause, Phone, Play, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

const TABS = [
  { id: 'data',       label: '📊 Dados',      countKey: null,            greenIfPositive: false },
  { id: 'onboarding', label: '📋 Onboarding', countKey: null,            greenIfPositive: false },
  { id: 'projects',   label: '🚀 Projetos',   countKey: 'projects',      greenIfPositive: false },
  { id: 'proposals',  label: '📄 Propostas',  countKey: 'proposals',     greenIfPositive: false },
  { id: 'financial',  label: '💰 Financeiro', countKey: 'transactions',  greenIfPositive: false },
  { id: 'history',    label: '💬 Histórico',  countKey: 'interactions',  greenIfPositive: false },
  { id: 'tasks',      label: '✅ Tarefas',    countKey: 'tasks_pending', greenIfPositive: true  },
]

interface ClientFolderProps {
  client: Client
  activeTab: string
}

export default function ClientFolder({ client: initialClient, activeTab }: ClientFolderProps) {
  const [client, setClient] = useState(initialClient)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const confirm = useConfirm()

  useEffect(() => {
    fetch(`/api/clients/${client.id}/counts`)
      .then((r) => r.json())
      .then(setCounts)
      .catch(() => {})
  }, [client.id])

  function setTab(tab: string) {
    router.push(`${pathname}?tab=${tab}`)
  }

  async function handleToggleStatus() {
    const newStatus = client.status === 'active' ? 'inactive' : 'active'
    const label = newStatus === 'inactive' ? 'pausar' : 'reativar'
    const ok = await confirm({
      title: `Deseja ${label} este cliente?`,
      confirmLabel: newStatus === 'inactive' ? 'Pausar' : 'Reativar',
    })
    if (!ok) return
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      setClient(updated)
      toast(newStatus === 'inactive' ? 'Cliente pausado' : 'Cliente reativado')
    } else {
      toast('Erro ao atualizar status do cliente', 'error')
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Remover este cliente permanentemente?',
      description: 'Esta ação não pode ser desfeita. Todos os dados vinculados serão removidos.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Cliente removido')
      router.push('/clients')
    } else {
      toast('Erro ao remover cliente', 'error')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">{client.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {client.company && (
                  <span className="flex items-center gap-1 text-slate-400 text-sm">
                    <Building2 size={13} />
                    {client.company}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1 text-slate-400 text-sm">
                    <Mail size={13} />
                    {client.email}
                  </span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1 text-slate-400 text-sm">
                    <Phone size={13} />
                    {client.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {client.monthly_value > 0 && (
              <span className="flex items-center gap-1.5 bg-emerald-900/20 text-emerald-400 border border-emerald-800 text-sm px-3 py-1 rounded-full">
                <DollarSign size={13} />
                {formatCurrency(client.monthly_value)}/mês
              </span>
            )}
            <Badge
              variant={
                client.status === 'active'
                  ? 'green'
                  : client.status === 'churned'
                  ? 'red'
                  : 'gray'
              }
            >
              {client.status === 'active'
                ? 'Ativo'
                : client.status === 'churned'
                ? 'Churned'
                : 'Inativo'}
            </Badge>
            <button
              onClick={handleToggleStatus}
              title={client.status === 'active' ? 'Pausar cliente' : 'Reativar cliente'}
              className="flex items-center gap-1.5 text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-600 rounded-lg px-3 py-1.5 text-xs transition-colors"
            >
              {client.status === 'active' ? (
                <>
                  <Pause size={13} />
                  Pausar
                </>
              ) : (
                <>
                  <Play size={13} />
                  Reativar
                </>
              )}
            </button>
            <button
              onClick={handleDelete}
              title="Remover cliente"
              className="text-slate-500 hover:text-red-400 transition-colors p-1.5"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-700 mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const count = tab.countKey ? (counts[tab.countKey] ?? 0) : 0
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-indigo-500 font-medium'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {tab.label}
              {tab.countKey && count > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab.greenIfPositive
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'data' && <DataTab client={client} onClientUpdated={setClient} />}
      {activeTab === 'onboarding' && <OnboardingTab clientId={client.id} />}
      {activeTab === 'projects' && <ProjectsTab clientId={client.id} />}
      {activeTab === 'proposals' && (
        <ProposalsTab clientId={client.id} clientName={client.name} />
      )}
      {activeTab === 'financial' && (
        <FinancialTab clientId={client.id} monthlyValue={client.monthly_value} />
      )}
      {activeTab === 'history' && <HistoryTab clientId={client.id} />}
      {activeTab === 'tasks' && <TasksTab clientId={client.id} />}
    </div>
  )
}
