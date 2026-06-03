'use client'

import { useState, useEffect } from 'react'
import type { Onboarding } from '@/lib/types'

interface OnboardingTabProps {
  clientId: string
}

const FIELDS: {
  key: keyof Omit<Onboarding, 'id' | 'client_id' | 'created_at' | 'updated_at'>
  label: string
  placeholder: string
  rows: number
}[] = [
  { key: 'segment', label: 'Segmento / Nicho', placeholder: 'Ex: E-commerce, SaaS, Clínica...', rows: 1 },
  { key: 'team_size', label: 'Tamanho da equipe', placeholder: 'Ex: 1-10, 10-50...', rows: 1 },
  { key: 'current_tools', label: 'Ferramentas atuais', placeholder: 'Ex: WhatsApp, Planilhas, CRM X...', rows: 2 },
  { key: 'main_pain', label: 'Principal dor / objetivo', placeholder: 'O que o cliente quer resolver?', rows: 2 },
  { key: 'accesses', label: 'Acessos entregues', placeholder: 'Z-API, Make, credenciais...', rows: 2 },
  { key: 'notes', label: 'Observações', placeholder: 'Contexto adicional, preferências...', rows: 3 },
]

export default function OnboardingTab({ clientId }: OnboardingTabProps) {
  const [data, setData] = useState<Partial<Onboarding>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const filledCount = FIELDS.filter((f) => {
    const val = data[f.key]
    return val !== null && val !== undefined && String(val).trim() !== ''
  }).length
  const pct = Math.round((filledCount / FIELDS.length) * 100)

  useEffect(() => {
    fetch(`/api/clients/${clientId}/onboarding`)
      .then((res) => res.json())
      .then((json) => {
        if (json) setData(json)
        setLoading(false)
      })
  }, [clientId])

  function handleChange(key: string, value: string) {
    setData((prev) => ({ ...prev, [key]: value || null }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/clients/${clientId}/onboarding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-4">
      {/* F8 — Progresso do Onboarding */}
      <div className="mb-4 p-3 bg-[#1e293b] border border-slate-700 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Progresso do Onboarding
          </span>
          <span className={`text-xs font-bold ${
            pct === 100 ? 'text-emerald-400' : pct >= 50 ? 'text-indigo-400' : 'text-amber-400'
          }`}>
            {pct}%
          </span>
        </div>
        <div className="bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-slate-500 text-xs mt-1">
          {filledCount} de {FIELDS.length} campos preenchidos
        </p>
      </div>
      {FIELDS.map(({ key, label, placeholder, rows }) => (
        <div key={key}>
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
            {label}
          </label>
          <textarea
            value={(data[key] as string) ?? ''}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full bg-[#1e293b] border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>
      ))}
      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
