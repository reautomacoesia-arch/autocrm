'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import type { Lead, LeadStage } from '@/lib/types'

interface EditLeadModalProps {
  lead: Lead | null
  onClose: () => void
  onLeadUpdated: (lead: Lead) => void
}

const STAGE_OPTIONS: { value: LeadStage; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'proposal_sent', label: 'Proposta Enviada' },
  { value: 'negotiating', label: 'Negociando' },
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perdido' },
]

export default function EditLeadModal({ lead, onClose, onLeadUpdated }: EditLeadModalProps) {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    estimated_value: '',
    stage: 'lead' as LeadStage,
    notes: '',
    instagram: '',
    website: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name,
        company: lead.company ?? '',
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        estimated_value: lead.estimated_value > 0 ? String(lead.estimated_value) : '',
        stage: lead.stage,
        notes: lead.notes ?? '',
        instagram: lead.instagram ?? '',
        website: lead.website ?? '',
      })
    }
  }, [lead])

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lead) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : 0,
        stage: form.stage,
        notes: form.notes || null,
        instagram: form.instagram || null,
        website: form.website || null,
      }),
    })

    if (!res.ok) {
      setError('Erro ao salvar. Tente novamente.')
      setLoading(false)
      return
    }

    const updated = await res.json()
    onLeadUpdated(updated)
    setLoading(false)
  }

  return (
    <Modal isOpen={!!lead} onClose={onClose} title="Editar Lead">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nome *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Empresa</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Telefone / WhatsApp</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="(11) 99999-0000"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Instagram</label>
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => handleChange('instagram', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="@empresa"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="https://empresa.com.br"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Valor estimado (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_value}
              onChange={(e) => handleChange('estimated_value', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Estágio</label>
            <select
              value={form.stage}
              onChange={(e) => handleChange('stage', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Observações</label>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={3}
            placeholder="Observações sobre o lead..."
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
