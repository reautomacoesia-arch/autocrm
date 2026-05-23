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
      }),
    })

    if (!res.ok) {
      setError('Erro ao criar lead. Tente novamente.')
      setLoading(false)
      return
    }

    const lead = await res.json()
    onLeadAdded(lead)
    setForm({ name: '', company: '', email: '', phone: '', estimated_value: '' })
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
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome do contato"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Empresa</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="email@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Telefone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="(11) 99999-0000"
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
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="0"
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
            {loading ? 'Criando...' : 'Criar Lead'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
