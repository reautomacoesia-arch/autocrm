'use client'

import { Droppable } from '@hello-pangea/dnd'
import type { Lead, LeadStage } from '@/lib/types'
import { STAGE_LABELS, STAGE_COLORS, formatCurrency } from '@/lib/pipeline'
import KanbanCard from './KanbanCard'

interface KanbanColumnProps {
  stage: LeadStage
  leads: Lead[]
  onCardClick: (lead: Lead) => void
}

export default function KanbanColumn({ stage, leads, onCardClick }: KanbanColumnProps) {
  const totalValue = leads.reduce((sum, lead) => sum + lead.estimated_value, 0)

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${STAGE_COLORS[stage]}`}>
            {STAGE_LABELS[stage]}
          </h3>
          <span className="text-slate-500 text-xs bg-slate-800 px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-slate-500 text-xs">{formatCurrency(totalValue)}</p>
        )}
      </div>

      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-32 rounded-lg p-2 space-y-2 transition-colors ${
              snapshot.isDraggingOver ? 'bg-slate-800/50' : 'bg-slate-800/20'
            }`}
          >
            {leads.map((lead, index) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                index={index}
                onClick={onCardClick}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}
