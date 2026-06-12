'use client'

import { useState } from 'react'
import type { AutomationWorkflow } from '@/lib/types'
import { getTrigger } from '@/lib/workflow-catalog'
import { useToast } from '@/components/ui/ToastProvider'
import WorkflowForm from './WorkflowForm'
import { Plus, Pencil, Trash2, Zap } from 'lucide-react'

interface WorkflowsSectionProps {
  initialWorkflows: AutomationWorkflow[]
}

export default function WorkflowsSection({ initialWorkflows }: WorkflowsSectionProps) {
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState(initialWorkflows)
  const [editing, setEditing] = useState<AutomationWorkflow | 'new' | null>(null)

  async function handleToggle(workflow: AutomationWorkflow) {
    const res = await fetch(`/api/automation-workflows/${workflow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !workflow.enabled }),
    })
    if (!res.ok) {
      toast('Erro ao atualizar automação', 'error')
      return
    }
    const updated = await res.json()
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
  }

  async function handleDelete(workflow: AutomationWorkflow) {
    if (!confirm(`Excluir a automação "${workflow.name}"?`)) return
    const res = await fetch(`/api/automation-workflows/${workflow.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast('Erro ao excluir automação', 'error')
      return
    }
    setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id))
    toast('Automação excluída')
  }

  function handleSaved(workflow: AutomationWorkflow) {
    setWorkflows((prev) => {
      const exists = prev.some((w) => w.id === workflow.id)
      return exists ? prev.map((w) => (w.id === workflow.id ? workflow : w)) : [...prev, workflow]
    })
    setEditing(null)
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 max-w-2xl">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Minhas automações</h2>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 text-xs text-indigo-400 border border-indigo-700/50 bg-indigo-600/10 rounded-full px-3 py-1 hover:bg-indigo-600/20 transition-colors"
        >
          <Plus size={12} /> Nova automação
        </button>
      </div>

      {workflows.length === 0 ? (
        <p className="text-slate-500 text-xs max-w-2xl">
          Crie regras personalizadas: escolha um evento (lead mudou de estágio, proposta mudou de status, cliente mudou de status),
          defina condições opcionais e as ações que devem ser executadas.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {workflows.map((workflow) => {
            const trigger = getTrigger(workflow.trigger_type)
            return (
              <div
                key={workflow.id}
                className={`bg-[#1a1a1d] border rounded-xl p-4 transition-colors ${workflow.enabled ? 'border-indigo-700' : 'border-slate-700'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-semibold">{workflow.name}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400">
                        <Zap size={9} />
                        {trigger?.label ?? workflow.trigger_type}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {workflow.conditions.length > 0 ? `${workflow.conditions.length} condição(ões) · ` : ''}
                      {workflow.actions.length} ação(ões)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => setEditing(workflow)} className="text-slate-400 hover:text-slate-200" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(workflow)} className="text-slate-400 hover:text-red-400" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => handleToggle(workflow)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${workflow.enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                      title={workflow.enabled ? 'Desativar' : 'Ativar'}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${workflow.enabled ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <WorkflowForm workflow={editing === 'new' ? null : editing} onSaved={handleSaved} onCancel={() => setEditing(null)} />
      )}
    </div>
  )
}
