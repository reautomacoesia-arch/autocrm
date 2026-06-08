'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Lead } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface ConvertToClientModalProps {
  lead: Lead
  onClose: () => void
  onConverted: () => void
}

export default function ConvertToClientModal({
  lead,
  onClose,
  onConverted,
}: ConvertToClientModalProps) {
  const [monthlyValue, setMonthlyValue] = useState(
    lead.estimated_value > 0 ? String(lead.estimated_value) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/leads/${lead.id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthly_value: monthlyValue ? parseFloat(monthlyValue) : 0,
      }),
    })

    if (!res.ok) {
      setError('Erro ao converter. Tente novamente.')
      setLoading(false)
      return
    }

    const client = await res.json()
    onConverted()
    router.push(`/clients/${client.id}`)
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Converter em Cliente">
      <div className="mb-4">
        <p className="text-slate-300 text-sm">
          Converter <strong className="text-white">{lead.name}</strong> em cliente ativo?
        </p>
        {lead.company && (
          <p className="text-slate-400 text-xs mt-1">{lead.company}</p>
        )}
      </div>
      <form onSubmit={handleConvert} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Valor mensal do contrato (R$)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyValue}
            onChange={(e) => setMonthlyValue(e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
            className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Convertendo...' : 'Converter ✓'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
