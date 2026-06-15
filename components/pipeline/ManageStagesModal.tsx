'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, X } from 'lucide-react'
import type { PipelineStage, PipelineStageType } from '@/lib/types'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface ManageStagesModalProps {
  isOpen: boolean
  stages: PipelineStage[]
  onClose: () => void
  onStagesChanged: () => void
}

const TYPE_LABELS: Record<PipelineStageType, string> = {
  open: 'Em aberto',
  won: 'Ganho',
  lost: 'Perdido',
}

export default function ManageStagesModal({ isOpen, stages, onClose, onStagesChanged }: ManageStagesModalProps) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [newStage, setNewStage] = useState({
    label: '',
    color: '#64748b',
    type: 'open' as PipelineStageType,
    probability: '0.3',
  })
  const [addSaving, setAddSaving] = useState(false)

  if (!isOpen) return null

  const sorted = [...stages].sort((a, b) => a.position - b.position)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newStage.label.trim()) return
    setAddSaving(true)
    const res = await fetch('/api/pipeline-stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: newStage.label,
        color: newStage.color,
        type: newStage.type,
        probability: parseFloat(newStage.probability) || 0,
      }),
    })
    if (res.ok) {
      setNewStage({ label: '', color: '#64748b', type: 'open', probability: '0.3' })
      toast('Coluna adicionada')
      onStagesChanged()
    } else {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao adicionar coluna', 'error')
    }
    setAddSaving(false)
  }

  async function handleUpdate(stage: PipelineStage, fields: Partial<Pick<PipelineStage, 'label' | 'color' | 'type' | 'probability'>>) {
    setSavingId(stage.id)
    const res = await fetch(`/api/pipeline-stages/${stage.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (res.ok) {
      onStagesChanged()
    } else {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao atualizar coluna', 'error')
    }
    setSavingId(null)
  }

  async function handleDelete(stage: PipelineStage) {
    const ok = await confirm({
      title: `Excluir a coluna "${stage.label}"?`,
      description: 'Essa ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Excluir',
    })
    if (!ok) return

    const res = await fetch(`/api/pipeline-stages/${stage.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Coluna excluída')
      onStagesChanged()
    } else {
      const data = await res.json().catch(() => null)
      toast(data?.error ?? 'Erro ao excluir coluna', 'error')
    }
  }

  async function handleMove(stage: PipelineStage, direction: 'up' | 'down') {
    const idx = sorted.findIndex((s) => s.id === stage.id)
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sorted.length) return

    const reordered = [...sorted]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(targetIdx, 0, moved)

    const res = await fetch('/api/pipeline-stages/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
    })
    if (res.ok) {
      onStagesChanged()
    } else {
      toast('Erro ao reordenar', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1d] border border-slate-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-base font-semibold">Colunas do pipeline</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {sorted.map((stage, idx) => (
            <div
              key={stage.id}
              className="flex items-center gap-2 bg-[#050505] border border-slate-700 rounded-lg px-3 py-2.5"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleMove(stage, 'up')}
                  disabled={idx === 0}
                  className="text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
                  title="Mover para cima"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(stage, 'down')}
                  disabled={idx === sorted.length - 1}
                  className="text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors"
                  title="Mover para baixo"
                >
                  <ArrowDown size={12} />
                </button>
              </div>

              <input
                type="color"
                value={stage.color}
                onChange={(e) => handleUpdate(stage, { color: e.target.value })}
                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer flex-shrink-0"
                title="Cor"
              />

              <input
                type="text"
                defaultValue={stage.label}
                onBlur={(e) => {
                  const val = e.target.value.trim()
                  if (val && val !== stage.label) handleUpdate(stage, { label: val })
                }}
                className="flex-1 min-w-[100px] bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              />

              <select
                value={stage.type}
                onChange={(e) => handleUpdate(stage, { type: e.target.value as PipelineStageType })}
                className="bg-[#1a1a1d] border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              >
                {(Object.keys(TYPE_LABELS) as PipelineStageType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  defaultValue={Math.round(stage.probability * 100)}
                  onBlur={(e) => {
                    const pct = parseFloat(e.target.value)
                    if (!Number.isNaN(pct)) handleUpdate(stage, { probability: Math.min(1, Math.max(0, pct / 100)) })
                  }}
                  className="w-14 bg-[#1a1a1d] border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                  title="Probabilidade de fechamento (%)"
                />
                <span className="text-slate-500 text-xs">%</span>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(stage)}
                disabled={savingId === stage.id}
                className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                title="Excluir coluna"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2 flex-wrap border-t border-slate-800 pt-4">
          <input
            type="color"
            value={newStage.color}
            onChange={(e) => setNewStage((p) => ({ ...p, color: e.target.value }))}
            className="w-9 h-9 rounded border border-slate-700 bg-transparent cursor-pointer flex-shrink-0"
            title="Cor"
          />
          <input
            type="text"
            required
            value={newStage.label}
            onChange={(e) => setNewStage((p) => ({ ...p, label: e.target.value }))}
            placeholder="Nome da nova coluna *"
            className="flex-1 min-w-[140px] bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
          <select
            value={newStage.type}
            onChange={(e) => setNewStage((p) => ({ ...p, type: e.target.value as PipelineStageType }))}
            className="bg-[#050505] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            {(Object.keys(TYPE_LABELS) as PipelineStageType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              step="5"
              value={Math.round(parseFloat(newStage.probability || '0') * 100)}
              onChange={(e) => setNewStage((p) => ({ ...p, probability: String((parseFloat(e.target.value) || 0) / 100) }))}
              className="w-16 bg-[#050505] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              title="Probabilidade de fechamento (%)"
            />
            <span className="text-slate-500 text-xs">%</span>
          </div>
          <button
            type="submit"
            disabled={addSaving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {addSaving ? '...' : '+ Adicionar'}
          </button>
        </form>
      </div>
    </div>
  )
}
