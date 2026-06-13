'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import type { Lead, LeadStage } from '@/lib/types'
import { STAGES } from '@/lib/pipeline'
import KanbanColumn from './KanbanColumn'
import AddLeadModal from './AddLeadModal'
import ManageLeadFieldsModal from './ManageLeadFieldsModal'
import EditLeadModal from './EditLeadModal'
import ConvertToClientModal from './ConvertToClientModal'
import PageHeader from '@/components/ui/PageHeader'
import { Plus } from 'lucide-react'

interface KanbanBoardProps {
  initialLeads: Lead[]
}

export default function KanbanBoard({ initialLeads }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isLeadFieldsOpen, setIsLeadFieldsOpen] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)

  const leadsByStage = STAGES.reduce<Record<LeadStage, Lead[]>>(
    (acc, stage) => {
      acc[stage] = leads.filter((l) => l.stage === stage)
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

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={`${activeCount} leads ativos`}
        action={
          <>
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
