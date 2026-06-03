'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import type { Lead } from '@/lib/types'
import { SOURCE_LABELS } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, DollarSign, X, MessageCircle } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface KanbanCardProps {
  lead: Lead
  index: number
  onEdit: (lead: Lead) => void
  onDelete: (leadId: string) => void
  onLeadUpdated: (updated: Lead) => void
}

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export default function KanbanCard({ lead, index, onEdit, onDelete, onLeadUpdated }: KanbanCardProps) {
  const confirm = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: lead.name,
    company: lead.company ?? '',
    estimated_value: String(lead.estimated_value),
    phone: lead.phone ?? '',
    source: lead.source ?? '',
    next_step: lead.next_step ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await confirm({
      title: `Remover o lead "${lead.name}"?`,
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (ok) {
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

  function handleCardClick() {
    if (lead.stage === 'won') {
      onEdit(lead)
    } else {
      setEditForm({
        name: lead.name,
        company: lead.company ?? '',
        estimated_value: String(lead.estimated_value),
        phone: lead.phone ?? '',
        source: lead.source ?? '',
        next_step: lead.next_step ?? '',
      })
      setIsEditing(true)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (saving) return
    setSaving(true)
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        company: editForm.company || null,
        estimated_value: parseFloat(editForm.estimated_value) || 0,
        phone: editForm.phone || null,
        email: lead.email,
        stage: lead.stage,
        notes: lead.notes,
        instagram: lead.instagram,
        website: lead.website,
        source: editForm.source || null,
        next_step: editForm.next_step || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      onLeadUpdated(updated)
      setIsEditing(false)
    }
    setSaving(false)
  }

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={isEditing ? undefined : handleCardClick}
          className={`bg-[#0f172a] border rounded-lg p-3 select-none transition-shadow relative ${
            isEditing
              ? 'border-indigo-500 cursor-default'
              : snapshot.isDragging
              ? 'border-indigo-500 shadow-lg shadow-indigo-900/20 cursor-pointer'
              : 'border-slate-700 hover:border-slate-600 cursor-pointer'
          }`}
        >
          {isEditing ? (
            <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()}>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                required
                autoFocus
                className="w-full bg-[#1e293b] border border-slate-600 text-white rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:border-indigo-500"
                placeholder="Nome *"
              />
              <input
                value={editForm.company}
                onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
                className="w-full bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:border-indigo-500"
                placeholder="Empresa"
              />
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.estimated_value}
                  onChange={(e) => setEditForm((p) => ({ ...p, estimated_value: e.target.value }))}
                  className="bg-[#1e293b] border border-slate-600 text-emerald-400 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="Valor (R$)"
                />
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="Telefone"
                />
              </div>
              <select
                value={editForm.source}
                onChange={(e) => setEditForm((p) => ({ ...p, source: e.target.value }))}
                className="bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500 mb-1.5"
              >
                <option value="">Origem...</option>
                <option value="instagram">Instagram</option>
                <option value="indicacao">Indicação</option>
                <option value="site">Site</option>
                <option value="linkedin">LinkedIn</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="outro">Outro</option>
              </select>
              <input
                value={editForm.next_step}
                onChange={(e) => setEditForm((p) => ({ ...p, next_step: e.target.value }))}
                className="bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500 mb-2"
                placeholder="Próximo passo..."
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsEditing(false) }}
                  className="flex-1 text-slate-500 border border-slate-700 rounded py-1 text-xs hover:border-slate-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded py-1 text-xs font-medium transition-colors"
                >
                  {saving ? '...' : 'Salvar'}
                </button>
              </div>
            </form>
          ) : (
            <>
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
              {lead.source && (
                <div className="mt-2">
                  <span className="text-[10px] bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded-full">
                    📥 {SOURCE_LABELS[lead.source] ?? lead.source}
                  </span>
                </div>
              )}
              {lead.next_step && (
                <div className="mt-2 border-l-2 border-amber-500 pl-2 bg-amber-950/20 rounded-r py-1">
                  <p className="text-amber-400 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Próximo passo</p>
                  <p className="text-amber-100 text-xs leading-tight">{lead.next_step}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Draggable>
  )
}
