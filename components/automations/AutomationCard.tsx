'use client'

import { useState } from 'react'
import type { AutomationConfig } from '@/lib/types'
import type { AutomationDefinition } from '@/lib/automations'
import { PRIORITY_LABELS } from '@/lib/automations'
import { useToast } from '@/components/ui/ToastProvider'

interface AutomationCardProps {
  definition: AutomationDefinition
  config: AutomationConfig | null
}

export default function AutomationCard({ definition, config }: AutomationCardProps) {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(config?.enabled ?? false)
  const [values, setValues] = useState<Record<string, unknown>>(
    (config?.config as Record<string, unknown>) ??
    Object.fromEntries(definition.fields.map((f) => [f.key, f.default]))
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/automations/${definition.key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, config: values }),
    })
    if (res.ok) {
      toast(enabled ? 'Automação ativada' : 'Automação desativada')
    } else {
      toast('Erro ao salvar', 'error')
    }
    setSaving(false)
  }

  function setValue(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const inputCls = 'w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className={`bg-[#1e293b] border rounded-xl p-4 transition-colors ${enabled ? 'border-indigo-700' : 'border-slate-700'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{definition.badge}</span>
          <div>
            <p className="text-white text-sm font-semibold">{definition.name}</p>
            <p className="text-slate-500 text-xs mt-0.5">{definition.description}</p>
          </div>
        </div>
        {/* Toggle */}
        <button
          onClick={() => setEnabled((p) => !p)}
          className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      {/* Config fields — only when enabled */}
      {enabled && (
        <div className="space-y-3 mt-3 pt-3 border-t border-slate-700">
          {definition.fields.map((field) => {
            if (field.dependsOn && !values[field.dependsOn]) return null

            return (
              <div key={field.key} className="flex items-center gap-3">
                {field.type === 'checkbox' ? (
                  <>
                    <input
                      type="checkbox"
                      id={`${definition.key}-${field.key}`}
                      checked={Boolean(values[field.key])}
                      onChange={(e) => setValue(field.key, e.target.checked)}
                      disabled={field.disabled}
                      className="w-4 h-4 accent-indigo-500 flex-shrink-0"
                    />
                    <label
                      htmlFor={`${definition.key}-${field.key}`}
                      className={`text-sm ${field.disabled ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-pointer'}`}
                    >
                      {field.label}
                      {field.disabled && <span className="ml-1 text-xs text-slate-600">(em breve)</span>}
                    </label>
                  </>
                ) : field.type === 'text' ? (
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={String(values[field.key] ?? '')}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ) : field.type === 'number' ? (
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                    <input
                      type="number"
                      min="0"
                      value={String(values[field.key] ?? 0)}
                      onChange={(e) => setValue(field.key, parseFloat(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </div>
                ) : field.type === 'select' ? (
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                    <select
                      value={String(values[field.key] ?? field.default)}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      className={inputCls}
                    >
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {PRIORITY_LABELS[opt] ?? opt}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            )
          })}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}

      {/* When disabled: show small save button to persist disabled state */}
      {!enabled && config !== null && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar desativado'}
        </button>
      )}
    </div>
  )
}
