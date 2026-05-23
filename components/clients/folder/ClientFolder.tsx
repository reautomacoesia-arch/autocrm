'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { Client } from '@/lib/types'
import OnboardingTab from './OnboardingTab'
import ProjectsTab from './ProjectsTab'
import HistoryTab from './HistoryTab'
import TasksTab from './TasksTab'
import ProposalsTab from './ProposalsTab'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, DollarSign, Mail, Phone } from 'lucide-react'

const TABS = [
  { id: 'onboarding', label: '📋 Onboarding' },
  { id: 'projects', label: '🚀 Projetos' },
  { id: 'proposals', label: '📄 Propostas' },
  { id: 'financial', label: '💰 Financeiro' },
  { id: 'history', label: '💬 Histórico' },
  { id: 'tasks', label: '✅ Tarefas' },
]

interface ClientFolderProps {
  client: Client
  activeTab: string
}

export default function ClientFolder({ client, activeTab }: ClientFolderProps) {
  const router = useRouter()
  const pathname = usePathname()

  function setTab(tab: string) {
    router.push(`${pathname}?tab=${tab}`)
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
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-700 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
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
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'onboarding' && <OnboardingTab clientId={client.id} />}
      {activeTab === 'projects' && <ProjectsTab clientId={client.id} />}
      {activeTab === 'proposals' && (
        <ProposalsTab clientId={client.id} clientName={client.name} />
      )}
      {activeTab === 'financial' && (
        <div className="text-center py-16 text-slate-500 text-sm">
          Módulo Financeiro — disponível no Plano 4.
        </div>
      )}
      {activeTab === 'history' && <HistoryTab clientId={client.id} />}
      {activeTab === 'tasks' && <TasksTab clientId={client.id} />}
    </div>
  )
}
