'use client'

import { useState } from 'react'
import type { Service } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface ServiceListProps {
  initialServices: Service[]
}

export default function ServiceList({ initialServices }: ServiceListProps) {
  const [services, setServices] = useState<Service[]>(initialServices)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', default_price: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '', default_price: '' })
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const confirm = useConfirm()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        default_price: form.default_price ? parseFloat(form.default_price) : 0,
      }),
    })
    const service = await res.json()
    setServices((prev) => [...prev, service].sort((a, b) => a.name.localeCompare(b.name)))
    setForm({ name: '', description: '', default_price: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || null,
        default_price: editForm.default_price ? parseFloat(editForm.default_price) : 0,
      }),
    })
    const updated = await res.json()
    setServices((prev) => prev.map((s) => (s.id === id ? updated : s)))
    setEditingId(null)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Remover este serviço?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    await fetch(`/api/services/${id}`, { method: 'DELETE' })
    setServices((prev) => prev.filter((s) => s.id !== id))
    toast('Serviço removido')
  }

  function startEdit(service: Service) {
    setEditingId(service.id)
    setEditForm({
      name: service.name,
      description: service.description ?? '',
      default_price: service.default_price > 0 ? String(service.default_price) : '',
    })
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-400 text-sm">{services.length} serviço(s)</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Novo Serviço
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-[#1e293b] border border-slate-700 rounded-lg p-4 mb-4 space-y-3"
        >
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Nome *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ex: Chatbot WhatsApp"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Preço padrão (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.default_price}
                onChange={(e) => setForm((p) => ({ ...p, default_price: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Breve descrição"
              />
            </div>
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
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {services.length === 0 ? (
          <EmptyState
            icon="⚙️"
            title="Nenhum serviço cadastrado"
            description="Cadastre seus serviços para usá-los nas propostas."
          />
        ) : (
          services.map((service) =>
            editingId === service.id ? (
              <div key={service.id} className="bg-[#1e293b] border border-indigo-700 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.default_price}
                      onChange={(e) => setEditForm((p) => ({ ...p, default_price: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="Preço padrão"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      placeholder="Descrição"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSaveEdit(service.id)}
                    disabled={saving}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
                  >
                    <Check size={14} /> Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-300 text-sm transition-colors"
                  >
                    <X size={14} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={service.id}
                className="flex items-start justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-white text-sm font-medium">{service.name}</p>
                  {service.description && (
                    <p className="text-slate-400 text-xs mt-0.5">{service.description}</p>
                  )}
                  {service.default_price > 0 && (
                    <p className="text-emerald-400 text-xs mt-1 font-medium">
                      {formatCurrency(service.default_price)}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => startEdit(service)}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}
