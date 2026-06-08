'use client'

import { useState } from 'react'
import type { Proposal, ProposalItem, ProposalStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

const STATUS_BADGE: Record<
  ProposalStatus,
  { label: string; variant: 'gray' | 'blue' | 'green' | 'red' }
> = {
  draft: { label: 'Rascunho', variant: 'gray' },
  sent: { label: 'Enviada', variant: 'blue' },
  approved: { label: 'Aprovada', variant: 'green' },
  rejected: { label: 'Recusada', variant: 'red' },
}

const STATUS_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['sent'],
  sent: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

type ProposalWithRelations = Proposal & {
  clients: { id: string; name: string; company: string | null; email: string | null } | null
  leads: { id: string; name: string; company: string | null; email: string | null } | null
  proposal_items: (ProposalItem & { services: { name: string } | null })[]
}

interface Service {
  id: string
  name: string
  default_price: number
}

interface ProposalDetailProps {
  proposal: ProposalWithRelations
  services: Service[]
}

export default function ProposalDetail({ proposal: initial, services }: ProposalDetailProps) {
  const [proposal, setProposal] = useState(initial)
  const [updating, setUpdating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    value: String(initial.value),
    valid_until: initial.valid_until ?? '',
    notes: initial.notes ?? '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [addForm, setAddForm] = useState({ serviceId: '', price: '' })
  const [addSaving, setAddSaving] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()

  const contact = proposal.clients ?? proposal.leads
  const transitions = STATUS_TRANSITIONS[proposal.status]

  async function changeStatus(status: ProposalStatus) {
    setUpdating(true)
    const res = await fetch(`/api/proposals/${proposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const updated = await res.json()
    setProposal((prev) => ({ ...prev, status: updated.status }))
    setUpdating(false)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (editSaving) return
    setEditSaving(true)
    const res = await fetch(`/api/proposals/${proposal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: parseFloat(editForm.value),
        valid_until: editForm.valid_until || null,
        notes: editForm.notes || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProposal((prev) => ({
        ...prev,
        value: updated.value,
        valid_until: updated.valid_until,
        notes: updated.notes,
      }))
      setIsEditing(false)
      toast('Proposta atualizada')
    }
    setEditSaving(false)
  }

  async function deleteProposal() {
    const ok = await confirm({
      title: 'Excluir esta proposta?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    await fetch(`/api/proposals/${proposal.id}`, { method: 'DELETE' })
    router.push('/proposals')
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.serviceId || !addForm.price || addSaving) return
    setAddSaving(true)
    const res = await fetch(`/api/proposals/${proposal.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: addForm.serviceId,
        price: parseFloat(addForm.price),
      }),
    })
    if (res.ok) {
      const newItem = await res.json()
      setProposal((prev) => ({
        ...prev,
        proposal_items: [...prev.proposal_items, newItem],
      }))
      setAddForm({ serviceId: '', price: '' })
      toast('Item adicionado')
    } else {
      toast('Erro ao adicionar item', 'error')
    }
    setAddSaving(false)
  }

  async function handleRemoveItem(itemId: string) {
    setProposal((prev) => ({
      ...prev,
      proposal_items: prev.proposal_items.filter((i) => i.id !== itemId),
    }))
    await fetch(`/api/proposals/${proposal.id}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
    })
    toast('Item removido')
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="bg-[#1a1a1d] rounded-xl border border-slate-700 p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {contact && (
              <>
                <h1 className="text-white text-xl font-bold">{contact.name}</h1>
                {contact.company && <p className="text-slate-400 text-sm">{contact.company}</p>}
                {contact.email && <p className="text-slate-500 text-xs mt-1">{contact.email}</p>}
              </>
            )}
            <p className="text-slate-500 text-xs mt-2">
              Criada em {formatDate(proposal.created_at)}
              {proposal.valid_until && ` · Válida até ${formatDate(proposal.valid_until)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE[proposal.status].variant}>
              {STATUS_BADGE[proposal.status].label}
            </Badge>
            <button
              onClick={() => {
                setEditForm({
                  value: String(proposal.value),
                  valid_until: proposal.valid_until ?? '',
                  notes: proposal.notes ?? '',
                })
                setIsEditing(true)
              }}
              className="text-slate-400 hover:text-indigo-400 transition-colors p-1"
              title="Editar proposta"
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>

        {transitions.length > 0 && !isEditing && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
            {transitions.map((status) => (
              <button
                key={status}
                onClick={() => changeStatus(status)}
                disabled={updating}
                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  status === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : status === 'rejected'
                    ? 'bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {status === 'sent'
                  ? 'Marcar como Enviada'
                  : status === 'approved'
                  ? 'Aprovar ✓'
                  : 'Recusar ✗'}
              </button>
            ))}
          </div>
        )}

        {isEditing && (
          <form
            onSubmit={handleEditSave}
            className="mt-4 pt-4 border-t border-slate-700 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Valor total (R$) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={editForm.value}
                  onChange={(e) => setEditForm((p) => ({ ...p, value: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Válida até</label>
                <input
                  type="date"
                  value={editForm.valid_until}
                  onChange={(e) => setEditForm((p) => ({ ...p, valid_until: e.target.value }))}
                  className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Observações</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium"
              >
                {editSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Items */}
      <div className="mb-6">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Itens da Proposta
        </h2>
        <div className="space-y-2">
          {proposal.proposal_items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3"
            >
              <div>
                <p className="text-white text-sm">
                  {item.custom_description ?? item.services?.name ?? 'Item sem descrição'}
                </p>
                {item.services && item.custom_description && (
                  <p className="text-slate-500 text-xs">{item.services.name}</p>
                )}
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <p className="text-emerald-400 text-sm font-semibold">
                  {formatCurrency(item.price)}
                </p>
                {proposal.status === 'draft' && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                    title="Remover item"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {proposal.status === 'draft' && (
          <form onSubmit={handleAddItem} className="flex gap-2 mt-3">
            <select
              value={addForm.serviceId}
              onChange={(e) => {
                const svc = services.find((s) => s.id === e.target.value)
                setAddForm((p) => ({
                  ...p,
                  serviceId: e.target.value,
                  price: svc && svc.default_price > 0 ? String(svc.default_price) : p.price,
                }))
              }}
              required
              className="flex-1 bg-[#1a1a1d] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Selecionar serviço...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={addForm.price}
              onChange={(e) => setAddForm((p) => ({ ...p, price: e.target.value }))}
              className="w-28 bg-[#1a1a1d] border border-slate-700 text-emerald-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="R$"
            />
            <button
              type="submit"
              disabled={addSaving}
              className="bg-indigo-600 hover:bg-indigo-500 text-[#050505] rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {addSaving ? '...' : '+ Adicionar'}
            </button>
          </form>
        )}

        <div className="flex justify-end mt-3 pt-3 border-t border-slate-700">
          <p className="text-white font-bold">
            Total:{' '}
            <span className="text-emerald-400">{formatCurrency(proposal.value)}</span>
          </p>
        </div>
      </div>

      {/* Notes */}
      {proposal.notes && !isEditing && (
        <div className="mb-6">
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Observações
          </h2>
          <p className="text-slate-300 text-sm bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3">
            {proposal.notes}
          </p>
        </div>
      )}

      <button
        onClick={deleteProposal}
        className="text-slate-500 hover:text-red-400 text-sm transition-colors"
      >
        Excluir proposta
      </button>
    </div>
  )
}
