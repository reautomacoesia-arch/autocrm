'use client'

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import type { CustomFieldDefinition, CustomFieldType, FieldWithValue } from '@/lib/types'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface CustomFieldsTabProps {
  entityType: 'client' | 'lead'
  entityId: string
}

function renderInput(
  def: CustomFieldDefinition,
  value: string,
  onChange: (v: string) => void,
  cls: string
) {
  switch (def.field_type) {
    case 'number':
      return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
    case 'date':
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
    case 'url':
      return <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://" className={cls} />
    case 'checkbox':
      return (
        <div className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-slate-400 text-sm">{value === 'true' ? 'Sim' : 'Não'}</span>
        </div>
      )
    case 'select':
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">Selecionar...</option>
          {(def.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
  }
}

export default function CustomFieldsTab({ entityType, entityId }: CustomFieldsTabProps) {
  const { toast } = useToast()
  const confirm = useConfirm()

  const [fields, setFields] = useState<FieldWithValue[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const [newField, setNewField] = useState<{
    name: string
    field_type: CustomFieldType
    options: string
  }>({ name: '', field_type: 'text', options: '' })
  const [addSaving, setAddSaving] = useState(false)

  const inputCls = 'w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500'

  useEffect(() => {
    fetch(`/api/custom-fields/values?entity_type=${entityType}&entity_id=${entityId}`)
      .then((r) => r.json())
      .then((data: FieldWithValue[]) => {
        setFields(data)
        const vals: Record<string, string> = {}
        for (const item of data) {
          vals[item.definition.id] = item.value ?? ''
        }
        setEditValues(vals)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [entityType, entityId])

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    const options =
      newField.field_type === 'select'
        ? newField.options.split(',').map((s) => s.trim()).filter(Boolean)
        : null
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: entityType,
        name: newField.name,
        field_type: newField.field_type,
        options,
      }),
    })
    if (res.ok) {
      const created: CustomFieldDefinition = await res.json()
      setFields((prev) => [...prev, { definition: created, value: null }])
      setEditValues((prev) => ({ ...prev, [created.id]: '' }))
      setNewField({ name: '', field_type: 'text', options: '' })
      toast('Campo adicionado')
    } else {
      toast('Erro ao adicionar campo', 'error')
    }
    setAddSaving(false)
  }

  async function handleDeleteField(defId: string, defName: string) {
    const ok = await confirm({
      title: `Remover campo "${defName}"?`,
      description: 'Os valores preenchidos em todos os registros serão apagados permanentemente.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    await fetch(`/api/custom-fields/${defId}`, { method: 'DELETE' })
    setFields((prev) => prev.filter((f) => f.definition.id !== defId))
    setEditValues((prev) => {
      const next = { ...prev }
      delete next[defId]
      return next
    })
    toast('Campo removido')
  }

  async function handleSaveValues(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const values = Object.entries(editValues).map(([definition_id, value]) => ({
      definition_id,
      value: value || null,
    }))
    const res = await fetch('/api/custom-fields/values', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: entityId, values }),
    })
    if (res.ok) {
      toast('Campos salvos')
    } else {
      toast('Erro ao salvar campos', 'error')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Seção 1: Gerenciar definições */}
      <div>
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Gerenciar campos
        </h2>

        <div className="space-y-2 mb-4">
          {fields.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              Nenhum campo personalizado ainda.
            </p>
          ) : (
            fields.map(({ definition: def }) => (
              <div
                key={def.id}
                className="flex items-center justify-between bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">{def.name}</span>
                  <span className="text-slate-600 text-xs bg-slate-800 px-2 py-0.5 rounded">
                    {def.field_type}
                  </span>
                  {def.options && (
                    <span className="text-slate-600 text-xs">
                      ({def.options.join(', ')})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteField(def.id, def.name)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                  title="Remover campo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAddField} className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[140px]">
            <input
              type="text"
              required
              value={newField.name}
              onChange={(e) => setNewField((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nome do campo *"
              className="w-full bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={newField.field_type}
            onChange={(e) =>
              setNewField((p) => ({ ...p, field_type: e.target.value as CustomFieldType }))
            }
            className="bg-[#1a1a1d] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Data</option>
            <option value="select">Seleção</option>
            <option value="checkbox">Checkbox</option>
            <option value="url">URL</option>
          </select>
          {newField.field_type === 'select' && (
            <div className="flex-1 min-w-[140px]">
              <input
                type="text"
                value={newField.options}
                onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                placeholder="Opções: A, B, C"
                className="w-full bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={addSaving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
          >
            {addSaving ? '...' : '+ Adicionar'}
          </button>
        </form>
      </div>

      {/* Seção 2: Valores */}
      {fields.length > 0 && (
        <form onSubmit={handleSaveValues}>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Valores
          </h2>
          <div className="space-y-4 mb-4">
            {fields.map(({ definition: def }) => (
              <div key={def.id}>
                <label className="block text-xs text-slate-400 mb-1.5">{def.name}</label>
                {renderInput(
                  def,
                  editValues[def.id] ?? '',
                  (v) => setEditValues((prev) => ({ ...prev, [def.id]: v })),
                  inputCls
                )}
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar campos'}
          </button>
        </form>
      )}
    </div>
  )
}
