'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Client, Lead } from '@/lib/types'

export interface LinkSelection {
  type: 'lead' | 'client'
  id: string
}

interface LinkLeadModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  leads: Lead[]
  onLink: (selection: LinkSelection) => void
}

export default function LinkLeadModal({ isOpen, onClose, clients, leads, onLink }: LinkLeadModalProps) {
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

    const [type, id] = selected.split(':')
    onLink({ type: type as 'lead' | 'client', id })
    setSelected('')
    setError(null)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Vincular a Lead/Cliente">
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

        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Vincular
          </button>
        </div>
      </form>
    </Modal>
  )
}
