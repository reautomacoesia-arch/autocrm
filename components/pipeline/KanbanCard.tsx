'use client'

import { Draggable } from '@hello-pangea/dnd'
import type { Lead } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, DollarSign, X, MessageCircle } from 'lucide-react'

interface KanbanCardProps {
  lead: Lead
  index: number
  onEdit: (lead: Lead) => void
  onDelete: (leadId: string) => void
}

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export default function KanbanCard({ lead, index, onEdit, onDelete }: KanbanCardProps) {
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`Remover o lead "${lead.name}"?`)) {
      onDelete(lead.id)
    }
  }

  function handleWhatsApp(e: React.MouseEvent) {
    e.stopPropagation()
    if (lead.phone) {
      const number = cleanPhone(lead.phone)
      window.open(`https://wa.me/55${number}`, '_blank')
    }
  }

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(lead)}
          className={`bg-[#0f172a] border rounded-lg p-3 cursor-pointer select-none transition-shadow relative ${
            snapshot.isDragging
              ? 'border-indigo-500 shadow-lg shadow-indigo-900/20'
              : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          <button
            onClick={handleDelete}
            className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition-colors"
            title="Remover lead"
          >
            <X size={13} />
          </button>

          <p className="text-white text-sm font-medium truncate pr-5">{lead.name}</p>
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

          {lead.phone && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleWhatsApp}
                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-400 transition-colors"
                title={`WhatsApp: ${lead.phone}`}
              >
                <MessageCircle size={13} />
                <span className="text-xs">WhatsApp</span>
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}
