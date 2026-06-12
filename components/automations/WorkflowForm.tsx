'use client'

import { useState } from 'react'
import type { AutomationWorkflow } from '@/lib/types'
import {
  TRIGGER_DEFINITIONS,
  ACTION_DEFINITIONS,
  OPERATOR_LABELS,
  getTrigger,
  getAction,
  type WorkflowCondition,
  type WorkflowAction,
  type ConditionOperator,
  type WorkflowTriggerType,
} from '@/lib/workflow-catalog'
import { useToast } from '@/components/ui/ToastProvider'
import { X, Plus, Trash2 } from 'lucide-react'

interface WorkflowFormProps {
  workflow: AutomationWorkflow | null
  onSaved: (workflow: AutomationWorkflow) => void
  onCancel: () => void
}

const inputCls = 'w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500'

export default function WorkflowForm({ workflow, onSaved, onCancel }: WorkflowFormProps) {
  const { toast } = useToast()
  const [name, setName] = useState(workflow?.name ?? '')
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(workflow?.trigger_type ?? TRIGGER_DEFINITIONS[0].type)
  const [conditions, setConditions] = useState<WorkflowCondition[]>(workflow?.conditions ?? [])
  const [actions, setActions] = useState<WorkflowAction[]>(workflow?.actions ?? [])
  const [saving, setSaving] = useState(false)

  const trigger = getTrigger(triggerType) ?? TRIGGER_DEFINITIONS[0]

  function handleTriggerChange(type: WorkflowTriggerType) {
    setTriggerType(type)
    setConditions([])
  }

  function addCondition() {
    const field = trigger.fields[0]
    setConditions((prev) => [...prev, { field: field.key, operator: 'eq', value: field.options?.[0]?.value ?? '' }])
  }

  function updateCondition(i: number, patch: Partial<WorkflowCondition>) {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }

  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addAction() {
    const def = ACTION_DEFINITIONS[0]
    setActions((prev) => [...prev, { type: def.type, params: Object.fromEntries(def.params.map((p) => [p.key, p.options?.[0]?.value ?? ''])) }])
  }

  function changeActionType(i: number, type: string) {
    const def = getAction(type) ?? ACTION_DEFINITIONS[0]
    setActions((prev) => prev.map((a, idx) => (idx === i ? { type: def.type, params: Object.fromEntries(def.params.map((p) => [p.key, p.options?.[0]?.value ?? ''])) } : a)))
  }

  function updateActionParam(i: number, key: string, value: string) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, params: { ...a.params, [key]: value } } : a)))
  }

  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast('Dê um nome para a automação.', 'error')
      return
    }
    if (actions.length === 0) {
      toast('Adicione ao menos uma ação.', 'error')
      return
    }

    setSaving(true)
    const payload = { name: name.trim(), trigger_type: triggerType, conditions, actions, enabled: workflow?.enabled ?? true }
    const res = workflow
      ? await fetch(`/api/automation-workflows/${workflow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/automation-workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

    if (!res.ok) {
      toast('Erro ao salvar automação', 'error')
      setSaving(false)
      return
    }
    const saved = await res.json()
    toast(workflow ? 'Automação atualizada' : 'Automação criada')
    onSaved(saved)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-base font-semibold">{workflow ? 'Editar automação' : 'Nova automação'}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="Ex: Avisar quando um lead grande for ganho"
            />
          </div>

          {/* Gatilho */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Quando isso acontecer</label>
            <select value={triggerType} onChange={(e) => handleTriggerChange(e.target.value as WorkflowTriggerType)} className={inputCls}>
              {TRIGGER_DEFINITIONS.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
            <p className="text-slate-500 text-xs mt-1">{trigger.description}</p>
          </div>

          {/* Condições */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-slate-500">Condições (opcional — todas precisam ser verdadeiras)</label>
              <button onClick={addCondition} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                <Plus size={12} /> Adicionar condição
              </button>
            </div>
            {conditions.length === 0 ? (
              <p className="text-slate-600 text-xs">Sem condições — a automação roda sempre que o evento ocorrer.</p>
            ) : (
              <div className="space-y-2">
                {conditions.map((cond, i) => {
                  const field = trigger.fields.find((f) => f.key === cond.field)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={cond.field}
                        onChange={(e) => updateCondition(i, { field: e.target.value, value: '' })}
                        className={`${inputCls} flex-1`}
                      >
                        {trigger.fields.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                      <select
                        value={cond.operator}
                        onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOperator })}
                        className={`${inputCls} w-44`}
                      >
                        {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
                          <option key={op} value={op}>{label}</option>
                        ))}
                      </select>
                      {field?.options ? (
                        <select value={cond.value} onChange={(e) => updateCondition(i, { value: e.target.value })} className={`${inputCls} flex-1`}>
                          <option value="">selecione...</option>
                          {field.options.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={cond.value}
                          onChange={(e) => updateCondition(i, { value: e.target.value })}
                          className={`${inputCls} flex-1`}
                        />
                      )}
                      <button onClick={() => removeCondition(i)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ações */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-slate-500">Então fazer isso</label>
              <button onClick={addAction} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                <Plus size={12} /> Adicionar ação
              </button>
            </div>
            <p className="text-slate-600 text-xs mb-2">
              Use variáveis nos campos de texto: {trigger.fields.map((f) => `{{${f.key}}}`).join(', ')}
            </p>
            {actions.length === 0 ? (
              <p className="text-slate-600 text-xs">Adicione ao menos uma ação.</p>
            ) : (
              <div className="space-y-3">
                {actions.map((action, i) => {
                  const def = getAction(action.type) ?? ACTION_DEFINITIONS[0]
                  return (
                    <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select value={action.type} onChange={(e) => changeActionType(i, e.target.value)} className={`${inputCls} flex-1`}>
                          {ACTION_DEFINITIONS.map((a) => (
                            <option key={a.type} value={a.type}>{a.label}</option>
                          ))}
                        </select>
                        <button onClick={() => removeAction(i)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-slate-500 text-[11px]">{def.description}</p>
                      {def.params.map((p) => (
                        <div key={p.key}>
                          <label className="block text-xs text-slate-500 mb-1">{p.label}</label>
                          {p.type === 'select' ? (
                            <select
                              value={action.params[p.key] ?? ''}
                              onChange={(e) => updateActionParam(i, p.key, e.target.value)}
                              className={inputCls}
                            >
                              {(p.options ?? []).map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : p.type === 'textarea' ? (
                            <textarea
                              value={action.params[p.key] ?? ''}
                              onChange={(e) => updateActionParam(i, p.key, e.target.value)}
                              rows={3}
                              className={`${inputCls} resize-y`}
                              placeholder={p.placeholder}
                            />
                          ) : (
                            <input
                              type="text"
                              value={action.params[p.key] ?? ''}
                              onChange={(e) => updateActionParam(i, p.key, e.target.value)}
                              className={inputCls}
                              placeholder={p.placeholder}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-700">
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
