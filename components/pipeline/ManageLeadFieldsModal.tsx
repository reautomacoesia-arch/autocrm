'use client'

import { useState, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import type { CustomFieldDefinition, CustomFieldType } from '@/lib/types'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface ManageLeadFieldsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ManageLeadFieldsModal({ isOpen, onClose }: ManageLeadFieldsModalProps) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [defs, setDefs] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [newField, setNewField] = useState<{
    name: string
    field_type: CustomFieldType
    options: string
  }>({ name: '', field_type: 'text', options: '' })
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/custom-fields?entity_type=lead')
      .then((r) => r.json())
      .then((data) => { setDefs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isOpen])

  async function handleAdd(e: React.FormEvent) {
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
        entity_type: 'lead',
        name: newField.name,
        field_type: newField.field_type,
        options,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setDefs((prev) => [...prev, created])
      setNewField({ name: '', field_type: 'text', options: '' })
      toast('Campo adicionado')
    } else {
      toast('Erro ao adicionar campo', 'error')
    }
    setAddSaving(false)
  }

  async function handleDelete(def: CustomFieldDefinition) {
    const ok = await confirm({
      title: `Remover campo "${def.name}"?`,
      description: 'Os valores de todos os leads serão apagados permanentemente.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    await fetch(`/api/custom-fields/${def.id}`, { method: 'DELETE' })
    setDefs((prev) => prev.filter((d) => d.id !== def.id))
    toast('Campo removido')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1d] border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-base font-semibold">Campos de leads</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm text-center py-4">Carregando...</p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {defs.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">Nenhum campo ainda.</p>
              ) : (
                defs.map((def) => (
                  <div
                    key={def.id}
                    className="flex items-center justify-between bg-[#050505] border border-slate-700 rounded-lg px-4 py-2.5"
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
                      onClick={() => handleDelete(def)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
              <input
                type="text"
                required
                value={newField.name}
                onChange={(e) => setNewField((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome do campo *"
                className="flex-1 min-w-[120px] bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <select
                value={newField.field_type}
                onChange={(e) =>
                  setNewField((p) => ({ ...p, field_type: e.target.value as CustomFieldType }))
                }
                className="bg-[#050505] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="text">Texto</option>
                <option value="number">Número</option>
                <option value="date">Data</option>
                <option value="select">Seleção</option>
                <option value="checkbox">Checkbox</option>
                <option value="url">URL</option>
              </select>
              {newField.field_type === 'select' && (
                <input
                  type="text"
                  value={newField.options}
                  onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                  placeholder="A, B, C"
                  className="flex-1 min-w-[100px] bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              )}
              <button
                type="submit"
                disabled={addSaving}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {addSaving ? '...' : '+ Adicionar'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
