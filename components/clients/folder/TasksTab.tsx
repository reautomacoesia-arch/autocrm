'use client'

import { useState, useEffect } from 'react'
import type { Task, TaskPriority, TaskStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

const PRIORITY_BADGE: Record<
  TaskPriority,
  { label: string; variant: 'red' | 'yellow' | 'gray' }
> = {
  high: { label: 'Alta', variant: 'red' },
  medium: { label: 'Média', variant: 'yellow' },
  low: { label: 'Baixa', variant: 'gray' },
}

const STATUS_BADGE: Record<
  TaskStatus,
  { label: string; variant: 'gray' | 'blue' | 'green' }
> = {
  pending: { label: 'Pendente', variant: 'gray' },
  in_progress: { label: 'Em andamento', variant: 'blue' },
  done: { label: 'Concluída', variant: 'green' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
}

interface TasksTabProps {
  clientId: string
}

export default function TasksTab({ clientId }: TasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const confirm = useConfirm()

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'pending' as TaskStatus,
    priority: 'medium' as TaskPriority,
    due_date: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/tasks?client_id=${clientId}`)
      .then((res) => res.json())
      .then((json) => {
        setTasks(json ?? [])
        setLoading(false)
      })
  }, [clientId])

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleEdit(e: React.FormEvent, taskId: string) {
    e.preventDefault()
    setEditSaving(true)
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title,
        description: editForm.description || null,
        status: editForm.status,
        priority: editForm.priority,
        due_date: editForm.due_date || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
      setEditingId(null)
      toast('Tarefa atualizada')
    }
    setEditSaving(false)
  }

  async function handleDelete(e: React.MouseEvent, taskId: string) {
    e.stopPropagation()
    const ok = await confirm({
      title: 'Remover esta tarefa?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    toast('Tarefa removida')
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      <p className="text-slate-400 text-sm mb-4">{tasks.length} tarefa(s) vinculada(s)</p>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <EmptyState
            icon="✅"
            title="Nenhuma tarefa vinculada"
            description="Crie tarefas no módulo de Tarefas para vinculá-las a este cliente."
          />
        ) : (
          tasks.map((task) => {
            if (editingId === task.id) {
              return (
                <form
                  key={task.id}
                  onSubmit={(e) => handleEdit(e, task.id)}
                  className="bg-[#1a1a1d] border border-indigo-500 rounded-lg p-4 space-y-3"
                >
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Título *</label>
                    <input
                      type="text"
                      required
                      value={editForm.title}
                      onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                      <select
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, status: e.target.value as TaskStatus }))
                        }
                        className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em andamento</option>
                        <option value="done">Concluída</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Prioridade</label>
                      <select
                        value={editForm.priority}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))
                        }
                        className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="high">Alta</option>
                        <option value="medium">Média</option>
                        <option value="low">Baixa</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Vencimento</label>
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))}
                        className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium"
                    >
                      {editSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              )
            }

            const priority = PRIORITY_BADGE[task.priority]
            const status = STATUS_BADGE[task.status]
            return (
              <div
                key={task.id}
                onClick={() => startEdit(task)}
                className="bg-[#1a1a1d] border border-slate-700 rounded-lg p-4 cursor-pointer hover:border-slate-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-slate-400 text-xs mt-1">{task.description}</p>
                    )}
                    {task.due_date && (
                      <p className="text-slate-500 text-xs mt-1">
                        Vence: {formatDate(task.due_date)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={priority.variant}>{priority.label}</Badge>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <button
                      onClick={(e) => handleDelete(e, task.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
