'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import type { Lead, PipelineStage } from '@/lib/types'
import { DEFAULT_STAGES } from '@/lib/pipeline'
import KanbanColumn from './KanbanColumn'
import LeadsTable from './LeadsTable'
import AddLeadModal from './AddLeadModal'
import ManageLeadFieldsModal from './ManageLeadFieldsModal'
import ManageStagesModal from './ManageStagesModal'
import EditLeadModal from './EditLeadModal'
import ConvertToClientModal from './ConvertToClientModal'
import PageHeader from '@/components/ui/PageHeader'
import { Download, Plus, Thermometer, Columns3, Rows3, Settings2 } from 'lucide-react'
import { exportToExcel } from '@/lib/export-excel'
import { SOURCE_LABELS } from '@/lib/types'
import { useNewParamModal } from '@/lib/hooks/useNewParamModal'
import { createClient } from '@/lib/supabase/client'

interface KanbanBoardProps {
  initialLeads: Lead[]
  initialStages: PipelineStage[]
}

type ViewMode = 'kanban' | 'list'

export default function KanbanBoard({ initialLeads, initialStages }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [stages, setStages] = useState<PipelineStage[]>(
    initialStages.length > 0 ? initialStages : DEFAULT_STAGES
  )
  // Auto-abre o modal de novo lead quando a URL tem ?new=1 (ex.: launcher de comandos)
  const [isAddModalOpen, setIsAddModalOpen] = useNewParamModal('/pipeline')
  const [isLeadFieldsOpen, setIsLeadFieldsOpen] = useState(false)
  const [isManageStagesOpen, setIsManageStagesOpen] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)
  const [sortByScore, setSortByScore] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [userId, setUserId] = useState<string | null>(null)

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  )

  const stagesBySlug = useMemo(() => {
    const map: Record<string, PipelineStage> = {}
    for (const s of sortedStages) map[s.slug] = s
    return map
  }, [sortedStages])

  // Carrega/salva a preferência de visualização (kanban|lista) por perfil
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      try {
        const raw = localStorage.getItem(`pipeline-view:${user.id}`)
        if (raw === 'list' || raw === 'kanban') setViewMode(raw)
      } catch {
        // localStorage indisponível
      }
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    try {
      localStorage.setItem(`pipeline-view:${userId}`, viewMode)
    } catch {
      // localStorage indisponível
    }
  }, [userId, viewMode])

  async function refreshStages() {
    const res = await fetch('/api/pipeline-stages')
    if (res.ok) {
      const data: PipelineStage[] = await res.json()
      setStages(data.length > 0 ? data : DEFAULT_STAGES)
    }
  }

  const sortedLeads = useMemo(() => {
    if (!sortByScore) return leads
    return [...leads].sort((a, b) => {
      const scoreA = a.score ?? -1
      const scoreB = b.score ?? -1
      return scoreB - scoreA
    })
  }, [leads, sortByScore])

  const leadsByStage = useMemo(() => {
    const acc: Record<string, Lead[]> = {}
    for (const stage of sortedStages) {
      acc[stage.slug] = sortedLeads.filter((l) => l.stage === stage.slug)
    }
    return acc
  }, [sortedStages, sortedLeads])

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return
      const leadId = result.draggableId
      const newStage = result.destination.droppableId
      const oldStage = result.source.droppableId
      if (newStage === oldStage) return

      const movedLead = leads.find((l) => l.id === leadId)

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
      )

      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (stagesBySlug[newStage]?.type === 'won' && movedLead) {
        setConvertLead({ ...movedLead, stage: newStage })
      }
    },
    [leads, stagesBySlug]
  )

  const handleLeadAdded = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev])
    setIsAddModalOpen(false)
  }

  const handleLeadUpdated = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)))
    setEditLead(null)
    if (stagesBySlug[updatedLead.stage]?.type === 'won') {
      setConvertLead(updatedLead)
    }
  }

  const handleLeadDeleted = async (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId))
    await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
  }

  const handleCardEdit = (lead: Lead) => {
    if (stagesBySlug[lead.stage]?.type === 'won') {
      setConvertLead(lead)
    } else {
      setEditLead(lead)
    }
  }

  async function handleListStageChange(lead: Lead, newStage: string) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: newStage } : l)))
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
    if (res.ok) {
      const updated = await res.json()
      if (stagesBySlug[newStage]?.type === 'won') {
        setConvertLead(updated)
      }
    }
  }

  const activeCount = leads.filter((l) => {
    const type = stagesBySlug[l.stage]?.type
    return type !== 'won' && type !== 'lost'
  }).length

  function handleExport() {
    exportToExcel(
      'leads',
      leads.map((l) => ({
        Nome: l.name,
        Empresa: l.company ?? '',
        Estágio: stagesBySlug[l.stage]?.label ?? l.stage,
        'Valor estimado': l.estimated_value,
        Origem: l.source ? (SOURCE_LABELS[l.source] ?? l.source) : '',
        Telefone: l.phone ?? '',
        'E-mail': l.email ?? '',
        Score: l.score ?? '',
      })),
      'Leads',
    )
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={`${activeCount} leads ativos`}
        action={
          <>
            <div className="flex gap-1 bg-[#1a1a1d] border border-slate-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visão Kanban"
              >
                <Columns3 size={13} />
                Kanban
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visão Lista"
              >
                <Rows3 size={13} />
                Lista
              </button>
            </div>
            <button
              onClick={handleExport}
              disabled={leads.length === 0}
              className="flex items-center gap-1.5 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-xs transition-colors"
            >
              <Download size={13} />
              Exportar Excel
            </button>
            <button
              onClick={() => setSortByScore((p) => !p)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
                sortByScore
                  ? 'text-indigo-300 border-indigo-700 bg-indigo-900/30'
                  : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600'
              }`}
              title="Ordenar leads por temperatura (score)"
            >
              <Thermometer size={15} />
              Ordenar por temperatura
            </button>
            <button
              onClick={() => setIsManageStagesOpen(true)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              <Settings2 size={15} />
              Colunas
            </button>
            <button
              onClick={() => setIsLeadFieldsOpen(true)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              ⚙️ Campos
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} />
              Novo Lead
            </button>
          </>
        }
      />

      {viewMode === 'kanban' ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {sortedStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage[stage.slug] ?? []}
                stagesBySlug={stagesBySlug}
                onCardEdit={handleCardEdit}
                onCardDelete={handleLeadDeleted}
                onCardUpdated={handleLeadUpdated}
              />
            ))}
          </div>
        </DragDropContext>
      ) : (
        <LeadsTable
          leads={sortedLeads}
          stages={sortedStages}
          stagesBySlug={stagesBySlug}
          onRowClick={handleCardEdit}
          onStageChange={handleListStageChange}
        />
      )}

      <AddLeadModal
        isOpen={isAddModalOpen}
        stages={sortedStages}
        onClose={() => setIsAddModalOpen(false)}
        onLeadAdded={handleLeadAdded}
      />

      <EditLeadModal
        lead={editLead}
        stages={sortedStages}
        onClose={() => setEditLead(null)}
        onLeadUpdated={handleLeadUpdated}
      />

      {convertLead && (
        <ConvertToClientModal
          lead={convertLead}
          onClose={() => setConvertLead(null)}
          onConverted={() => {
            setLeads((prev) => prev.filter((l) => l.id !== convertLead.id))
            setConvertLead(null)
          }}
        />
      )}

      <ManageLeadFieldsModal
        isOpen={isLeadFieldsOpen}
        onClose={() => setIsLeadFieldsOpen(false)}
      />

      <ManageStagesModal
        isOpen={isManageStagesOpen}
        stages={sortedStages}
        onClose={() => setIsManageStagesOpen(false)}
        onStagesChanged={refreshStages}
      />
    </>
  )
}
