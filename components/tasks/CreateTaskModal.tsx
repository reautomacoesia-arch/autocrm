'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Client, Profile, Task, TaskPriority, TaskStatus } from '@/lib/types'
import { X } from 'lucide-react'
import MultiAssigneeSelector from '@/components/team/MultiAssigneeSelector'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  profiles: Profile[]
  onTaskCreated: (task: Task) => void
  defaultClientId?: string
  defaultStatus?: TaskStatus
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  clients,
  profiles,
  onTaskCreated,
  defaultClientId,
  defaultStatus = 'pending',
}: CreateTaskModalProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    due_date: '',
    client_id: defaultClientId ?? '',
    assigned_to_ids: [] as string[],
  })
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) return
    setTags((prev) => [...prev, t])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        due_date: form.due_date || null,
        client_id: form.client_id || null,
        assigned_to_ids: form.assigned_to_ids,
        tags,
        status: defaultStatus,
      }),
    })

    if (!res.ok) {
      setError('Erro ao criar tarefa.')
      setLoading(false)
      return
    }

    const task = await res.json()
    onTaskCreated(task)
    setForm({ title: '', description: '', priority: 'medium', due_date: '', client_id: defaultClientId ?? '', assigned_to_ids: [] })
    setTags([])
    setTagInput('')
    setLoading(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Tarefa">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Título *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="O que precisa ser feito?"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Prioridade</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Vencimento</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Responsáveis</label>
          <MultiAssigneeSelector
            profiles={profiles}
            value={form.assigned_to_ids}
            onChange={(ids) => setForm((p) => ({ ...p, assigned_to_ids: ids }))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 bg-indigo-600/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              placeholder="Adicionar tag (Enter)"
              className="flex-1 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={addTag}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-3 text-sm transition-colors"
            >
              +
            </button>
          </div>
        </div>
        {clients.length > 0 && (
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Cliente (opcional)</label>
            <select
              value={form.client_id}
              onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `— ${c.company}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium"
          >
            {loading ? 'Criando...' : 'Criar Tarefa'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
