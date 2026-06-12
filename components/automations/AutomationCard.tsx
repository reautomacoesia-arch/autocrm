'use client'

import { useState } from 'react'
import type { AutomationConfig } from '@/lib/types'
import type { AutomationDefinition } from '@/lib/automations'
import { PRIORITY_LABELS } from '@/lib/automations'
import { useToast } from '@/components/ui/ToastProvider'
import { ChevronDown, ChevronUp, Clock, Zap } from 'lucide-react'

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
  const [showDetails, setShowDetails] = useState(false)

  const isCron = definition.trigger.toLowerCase().includes('cron')

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

  const inputCls = 'w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className={`bg-[#1a1a1d] border rounded-xl p-4 transition-colors ${enabled ? 'border-indigo-700' : 'border-slate-700'}`}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0 mt-0.5">{definition.badge}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white text-sm font-semibold">{definition.name}</p>
              {/* Trigger badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                isCron
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}>
                {isCron ? <Clock size={9} /> : <Zap size={9} />}
                {isCron ? 'Cron diário 09h' : 'Evento'}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">{definition.description}</p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setEnabled((p) => !p)}
          className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
          title={enabled ? 'Desativar automação' : 'Ativar automação'}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enabled ? 'left-5' : 'left-1'}`} />
        </button>
      </div>

      {/* ── Info expandível ── */}
      <button
        type="button"
        onClick={() => setShowDetails((p) => !p)}
        className="mt-3 flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
      >
        {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showDetails ? 'Ocultar detalhes' : 'Como funciona?'}
      </button>

      {showDetails && (
        <div className="mt-3 bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-3 space-y-3">
          {/* Gatilho */}
          <div>
            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Gatilho</p>
            <p className="text-slate-300 text-xs">{definition.trigger}</p>
          </div>

          {/* O que faz */}
          <div>
            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">O que acontece</p>
            <ul className="space-y-1">
              {definition.details.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-indigo-500 flex-shrink-0 mt-0.5">•</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>

          {/* Exemplo */}
          <div>
            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Exemplo prático</p>
            <p className="text-slate-400 text-xs italic leading-relaxed">{definition.example}</p>
          </div>
        </div>
      )}

      {/* ── Config fields — só quando ativo ── */}
      {enabled && (
        <div className="space-y-3 mt-4 pt-4 border-t border-slate-700">
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
                ) : field.type === 'textarea' ? (
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                    <textarea
                      value={String(values[field.key] ?? '')}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      rows={6}
                      className={`${inputCls} resize-y`}
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
            className="mt-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}

      {/* Quando desativado: botão discreto para salvar estado desligado */}
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
