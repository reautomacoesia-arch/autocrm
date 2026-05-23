'use client'

import { Draggable } from '@hello-pangea/dnd'
import type { Lead } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, DollarSign } from 'lucide-react'

interface KanbanCardProps {
  lead: Lead
  index: number
  onClick: (lead: Lead) => void
}

export default function KanbanCard({ lead, index, onClick }: KanbanCardProps) {
  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(lead)}
          className={`bg-[#0f172a] border rounded-lg p-3 cursor-pointer select-none transition-shadow ${
            snapshot.isDragging
              ? 'border-indigo-500 shadow-lg shadow-indigo-900/20'
              : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <p className="text-white text-sm font-medium truncate">{lead.name}</p>
          {lead.company && (
            <div className="flex items-center gap-1 mt-1">
              <Building2 size={11} className="text-slate-500 flex-shrink-0" />
              <p className="text-slate-400 text-xs truncate">{lead.company}</p>
            </div>
          )}
          {lead.estimated_value > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <DollarSign size={11} className="text-emerald-500 flex-shrink-0" />
              <p className="text-emerald-400 text-xs font-medium">
                {formatCurrency(lead.estimated_value)}
              </p>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}
