'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import type { Lead, LeadStage } from '@/lib/types'
import { STAGES, STAGE_LABELS } from '@/lib/pipeline'
import KanbanColumn from './KanbanColumn'
import AddLeadModal from './AddLeadModal'
import ManageLeadFieldsModal from './ManageLeadFieldsModal'
import EditLeadModal from './EditLeadModal'
import ConvertToClientModal from './ConvertToClientModal'
import PageHeader from '@/components/ui/PageHeader'
import { Download, Plus, Thermometer } from 'lucide-react'
import { exportToExcel } from '@/lib/export-excel'
import { SOURCE_LABELS } from '@/lib/types'
import { useNewParamModal } from '@/lib/hooks/useNewParamModal'

interface KanbanBoardProps {
  initialLeads: Lead[]
}

export default function KanbanBoard({ initialLeads }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  // Auto-abre o modal de novo lead quando a URL tem ?new=1 (ex.: launcher de comandos)
  const [isAddModalOpen, setIsAddModalOpen] = useNewParamModal('/pipeline')
  const [isLeadFieldsOpen, setIsLeadFieldsOpen] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)
  const [sortByScore, setSortByScore] = useState(false)

  const leadsByStage = STAGES.reduce<Record<LeadStage, Lead[]>>(
    (acc, stage) => {
      const stageLeads = leads.filter((l) => l.stage === stage)
      if (sortByScore) {
        stageLeads.sort((a, b) => {
          const scoreA = a.score ?? -1
          const scoreB = b.score ?? -1
          return scoreB - scoreA
        })
      }
      acc[stage] = stageLeads
      return acc
    },
    {} as Record<LeadStage, Lead[]>
  )

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return
      const leadId = result.draggableId
      const newStage = result.destination.droppableId as LeadStage
      const oldStage = result.source.droppableId as LeadStage
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

      if (newStage === 'won' && movedLead) {
        setConvertLead({ ...movedLead, stage: 'won' })
      }
    },
    [leads]
  )

  const handleLeadAdded = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev])
    setIsAddModalOpen(false)
  }

  const handleLeadUpdated = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)))
    setEditLead(null)
    if (updatedLead.stage === 'won') {
      setConvertLead(updatedLead)
    }
  }

  const handleLeadDeleted = async (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId))
    await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
  }

  const handleCardEdit = (lead: Lead) => {
    if (lead.stage === 'won') {
      setConvertLead(lead)
    } else {
      setEditLead(lead)
    }
  }

  const activeCount = leads.filter(
    (l) => l.stage !== 'won' && l.stage !== 'lost'
  ).length

  function handleExport() {
    exportToExcel(
      'leads',
      leads.map((l) => ({
        Nome: l.name,
        Empresa: l.company ?? '',
        Estágio: STAGE_LABELS[l.stage],
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

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              leads={leadsByStage[stage]}
              onCardEdit={handleCardEdit}
              onCardDelete={handleLeadDeleted}
              onCardUpdated={handleLeadUpdated}
            />
          ))}
        </div>
      </DragDropContext>

      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onLeadAdded={handleLeadAdded}
      />

      <EditLeadModal
        lead={editLead}
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
    </>
  )
}
