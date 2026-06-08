'use client'

import { useState, useEffect } from 'react'
import type { Interaction, InteractionType } from '@/lib/types'
import EmptyState from '@/components/ui/EmptyState'
import { MessageSquare, Phone, Mail, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

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
  const { toast } = useToast()
  const confirm = useConfirm()
  const [filterType, setFilterType] = useState<'all' | 'note' | 'meeting' | 'email'>('all')

  const filteredInteractions = filterType === 'all'
    ? interactions
    : interactions.filter((i) => i.type === filterType)

  useEffect(() => {
    fetch(`/api/clients/${clientId}/interactions`)
      .then((res) => res.json())
      .then((json) => {
        setInteractions(json ?? [])
        setLoading(false)
      })
  }, [clientId])

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Remover esta interação?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setInteractions((prev) => prev.filter((i) => i.id !== id))
    await fetch(`/api/clients/${clientId}/interactions/${id}`, { method: 'DELETE' })
    toast('Interação removida')
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
          className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4 mb-4 space-y-3"
        >
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((p) => ({ ...p, type: e.target.value as InteractionType }))
              }
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
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
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
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
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium"
            >
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      {/* A1 — Filtro por tipo */}
      <div className="flex gap-2 flex-wrap mb-3">
        {(['all', 'note', 'meeting', 'email'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              filterType === f
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {f === 'all'
              ? `Todas (${interactions.length})`
              : TYPE_LABELS[f as InteractionType]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredInteractions.length === 0 ? (
          interactions.length === 0 ? (
            <EmptyState
              icon="💬"
              title="Nenhuma interação registrada"
              description="Registre notas, reuniões e emails para acompanhar o relacionamento."
            />
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              Nenhuma interação do tipo selecionado.
            </div>
          )
        ) : (
          <div className="space-y-3">
            {filteredInteractions.map((interaction) => (
              <div key={interaction.id} className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mt-0.5">
                  {TYPE_ICONS[interaction.type]}
                </div>
                <div className="flex-1 bg-[#1a1a1d] border border-slate-700 rounded-lg p-3">
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
