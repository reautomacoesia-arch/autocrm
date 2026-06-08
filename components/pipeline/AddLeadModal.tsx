'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Lead } from '@/lib/types'

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onLeadAdded: (lead: Lead) => void
}

export default function AddLeadModal({ isOpen, onClose, onLeadAdded }: AddLeadModalProps) {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    estimated_value: '',
    instagram: '',
    website: '',
    notes: '',
    source: '',
    next_step: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : 0,
        instagram: form.instagram || null,
        website: form.website || null,
        notes: form.notes || null,
        source: form.source || null,
        next_step: form.next_step || null,
      }),
    })

    if (!res.ok) {
      setError('Erro ao criar lead. Tente novamente.')
      setLoading(false)
      return
    }

    const lead = await res.json()
    onLeadAdded(lead)
    setForm({ name: '', company: '', email: '', phone: '', estimated_value: '', instagram: '', website: '', notes: '', source: '', next_step: '' })
    setLoading(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Lead">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nome *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome do contato"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Empresa</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome da empresa"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="email@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Telefone / WhatsApp</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="@empresa"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="https://empresa.com.br"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Valor estimado (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.estimated_value}
            onChange={(e) => handleChange('estimated_value', e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Observações</label>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={2}
            placeholder="Observações sobre o lead..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Origem</label>
            <select
              value={form.source}
              onChange={(e) => handleChange('source', e.target.value)}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Selecionar...</option>
              <option value="instagram">Instagram</option>
              <option value="indicacao">Indicação</option>
              <option value="site">Site</option>
              <option value="linkedin">LinkedIn</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Próximo passo</label>
            <input
              type="text"
              value={form.next_step}
              onChange={(e) => handleChange('next_step', e.target.value)}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ex: Enviar proposta..."
            />
          </div>
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
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Criando...' : 'Criar Lead'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
