'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Client, Lead } from '@/lib/types'
import { Sparkles } from 'lucide-react'

interface GenerateProposalModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  leads: Lead[]
}

const GERADOR_URL = process.env.NEXT_PUBLIC_GERADOR_PROPOSTAS_URL ?? ''

export default function GenerateProposalModal({
  isOpen,
  onClose,
  clients,
  leads,
}: GenerateProposalModalProps) {
  const [selected, setSelected] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setSelected('')
    setError(null)
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selected) {
      setError('Selecione um cliente ou lead.')
      return
    }
    if (!GERADOR_URL) {
      setError('Integração não configurada (NEXT_PUBLIC_GERADOR_PROPOSTAS_URL ausente).')
      return
    }

    const [type, id] = selected.split(':')
    const source = type === 'client'
      ? clients.find((c) => c.id === id)
      : leads.find((l) => l.id === id)
    if (!source) return

    const params = new URLSearchParams()
    if (source.name) params.set('client_name', source.name)
    if (source.email) params.set('client_email', source.email)
    if (source.phone) params.set('client_phone', source.phone)
    if (source.company) params.set('client_company', source.company)
    if (type === 'client') {
      params.set('crm_client_id', id)
    } else {
      params.set('crm_lead_id', id)
    }

    window.open(`${GERADOR_URL}/proposals/new?${params.toString()}`, '_blank')
    handleClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nova Proposta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Cliente ou lead</label>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value)
              setError(null)
            }}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Selecione...</option>
            {clients.length > 0 && (
              <optgroup label="Clientes">
                {clients.map((c) => (
                  <option key={`client:${c.id}`} value={`client:${c.id}`}>
                    {c.name} {c.company ? `— ${c.company}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {leads.length > 0 && (
              <optgroup label="Leads">
                {leads.map((l) => (
                  <option key={`lead:${l.id}`} value={`lead:${l.id}`}>
                    {l.name} {l.company ? `— ${l.company}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <p className="text-slate-500 text-xs">
          Você será levado ao Gerador de Propostas com os dados já preenchidos. Lá a IA gera o
          texto, o cliente assina e paga — o status volta a aparecer aqui automaticamente.
        </p>

        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors"
          >
            <Sparkles size={14} />
            Gerar Proposta
          </button>
        </div>
      </form>
    </Modal>
  )
}
