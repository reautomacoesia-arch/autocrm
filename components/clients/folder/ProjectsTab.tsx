'use client'

import { useState, useEffect } from 'react'
import type { Project, ProjectStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { Plus } from 'lucide-react'

const STATUS_BADGE: Record<
  ProjectStatus,
  { label: string; variant: 'blue' | 'green' | 'yellow' | 'gray' }
> = {
  in_progress: { label: 'Em andamento', variant: 'blue' },
  completed: { label: 'Concluído', variant: 'green' },
  paused: { label: 'Pausado', variant: 'yellow' },
  cancelled: { label: 'Cancelado', variant: 'gray' },
}

interface ProjectsTabProps {
  clientId: string
}

export default function ProjectsTab({ clientId }: ProjectsTabProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'in_progress' as ProjectStatus,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/clients/${clientId}/projects`)
      .then((res) => res.json())
      .then((json) => {
        setProjects(json ?? [])
        setLoading(false)
      })
  }, [clientId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const project = await res.json()
    setProjects((prev) => [project, ...prev])
    setForm({ name: '', description: '', status: 'in_progress' })
    setShowForm(false)
    setSaving(false)
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-400 text-sm">{projects.length} projeto(s)</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          <Plus size={14} />
          Novo projeto
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
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              rows={2}
            />
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
        {projects.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhum projeto cadastrado ainda.
          </div>
        ) : (
          projects.map((project) => {
            const badge = STATUS_BADGE[project.status]
            return (
              <div key={project.id} className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{project.name}</p>
                    {project.description && (
                      <p className="text-slate-400 text-xs mt-1">{project.description}</p>
                    )}
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
