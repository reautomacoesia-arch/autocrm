'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Client, InboxChannel, InboxConversation, Lead } from '@/lib/types'
import { CHANNEL_LABELS } from '@/lib/inbox'

interface NewConversationModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  leads: Lead[]
  onCreated: (conversation: InboxConversation) => void
}

type LinkMode = 'existing' | 'standalone'

export default function NewConversationModal({
  isOpen,
  onClose,
  clients,
  leads,
  onCreated,
}: NewConversationModalProps) {
  const [channel, setChannel] = useState<InboxChannel>('whatsapp')
  const [linkMode, setLinkMode] = useState<LinkMode>('standalone')
  const [selectedSource, setSelectedSource] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactHandle, setContactHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setChannel('whatsapp')
    setLinkMode('standalone')
    setSelectedSource('')
    setContactName('')
    setContactHandle('')
    setError(null)
    setLoading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function applySource(value: string, ch: InboxChannel) {
    const [type, id] = value.split(':')
    const source = type === 'client' ? clients.find((c) => c.id === id) : leads.find((l) => l.id === id)
    if (!source) return
    setContactName(source.name)
    if (ch === 'whatsapp') setContactHandle(source.phone ?? '')
    else if (ch === 'instagram') setContactHandle(source.instagram ?? '')
    else setContactHandle('')
  }

  function handleChannelChange(next: InboxChannel) {
    setChannel(next)
    if (linkMode === 'existing' && selectedSource) {
      applySource(selectedSource, next)
    }
  }

  function handleSourceChange(value: string) {
    setSelectedSource(value)
    if (!value) {
      setContactName('')
      setContactHandle('')
      return
    }
    applySource(value, channel)
  }

  function handleLinkModeChange(mode: LinkMode) {
    setLinkMode(mode)
    setSelectedSource('')
    setContactName('')
    setContactHandle('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactName.trim()) {
      setError('Informe o nome do contato.')
      return
    }

    setLoading(true)
    setError(null)

    const [type, id] =
      linkMode === 'existing' && selectedSource ? selectedSource.split(':') : [null, null]

    const res = await fetch('/api/inbox/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        contact_name: contactName.trim(),
        contact_handle: contactHandle.trim() || null,
        lead_id: type === 'lead' ? id : null,
        client_id: type === 'client' ? id : null,
      }),
    })

    if (!res.ok) {
      setError('Erro ao criar conversa. Tente novamente.')
      setLoading(false)
      return
    }

    const conversation = await res.json()
    onCreated(conversation)
    reset()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nova conversa">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Canal</label>
          <div className="flex gap-1.5">
            {(['whatsapp', 'instagram', 'facebook'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => handleChannelChange(ch)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  channel === ch
                    ? 'bg-indigo-600 text-[#050505]'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {CHANNEL_LABELS[ch]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => handleLinkModeChange('existing')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              linkMode === 'existing'
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Vincular a Lead/Cliente
          </button>
          <button
            type="button"
            onClick={() => handleLinkModeChange('standalone')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              linkMode === 'standalone'
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Contato avulso
          </button>
        </div>

        {linkMode === 'existing' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Cliente ou lead</label>
            <select
              value={selectedSource}
              onChange={(e) => handleSourceChange(e.target.value)}
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
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nome do contato *</label>
          <input
            type="text"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome do contato"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            {channel === 'whatsapp' ? 'Telefone' : 'Usuário / @handle'}
          </label>
          <input
            type="text"
            value={contactHandle}
            onChange={(e) => setContactHandle(e.target.value)}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder={channel === 'whatsapp' ? '+5511999999999' : '@usuario'}
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
            onClick={handleClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Criando...' : 'Criar conversa'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
