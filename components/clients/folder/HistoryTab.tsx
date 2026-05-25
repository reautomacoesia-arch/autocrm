'use client'

import { useState, useEffect } from 'react'
import type { Interaction, InteractionType } from '@/lib/types'
import { MessageSquare, Phone, Mail, Plus, Trash2 } from 'lucide-react'

const TYPE_ICONS: Record<InteractionType, React.ReactNode> = {
  note: <MessageSquare size={13} />,
  meeting: <Phone size={13} />,
  email: <Mail size={13} />,
}

const TYPE_LABELS: Record<InteractionType, string> = {
  note: 'Nota',
  meeting: 'Reunião',
  email: 'Email',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface HistoryTabProps {
  clientId: string
}

export default function HistoryTab({ clientId }: HistoryTabProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'note' as InteractionType, description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/clients/${clientId}/interactions`)
      .then((res) => res.json())
      .then((json) => {
        setInteractions(json ?? [])
        setLoading(false)
      })
  }, [clientId])

  async function handleDelete(id: string) {
    setInteractions((prev) => prev.filter((i) => i.id !== id))
    await fetch(`/api/clients/${clientId}/interactions/${id}`, { method: 'DELETE' })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const interaction = await res.json()
    setInteractions((prev) => [interaction, ...prev])
    setForm({ type: 'note', description: '' })
    setShowForm(false)
    setSaving(false)
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-400 text-sm">{interactions.length} registro(s)</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          <Plus size={14} />
          Registrar interação
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-[#1e293b] border border-slate-700 rounded-lg p-4 mb-4 space-y-3"
        >
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((p) => ({ ...p, type: e.target.value as InteractionType }))
              }
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="note">Nota</option>
              <option value="meeting">Reunião</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Descrição *</label>
            <textarea
              required
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              rows={3}
              placeholder="O que aconteceu?"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
            >
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {interactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhuma interação registrada ainda.
          </div>
        ) : (
          interactions.map((interaction) => (
            <div key={interaction.id} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mt-0.5">
                {TYPE_ICONS[interaction.type]}
              </div>
              <div className="flex-1 bg-[#1e293b] border border-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    {TYPE_LABELS[interaction.type]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {formatDate(interaction.happened_at)}
                    </span>
                    <button
                      onClick={() => handleDelete(interaction.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-slate-300 text-sm">{interaction.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
