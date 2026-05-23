'use client'

import { useState, useEffect } from 'react'
import type { Task, TaskPriority, TaskStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'

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
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

interface TasksTabProps {
  clientId: string
}

export default function TasksTab({ clientId }: TasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tasks?client_id=${clientId}`)
      .then((res) => res.json())
      .then((json) => {
        setTasks(json ?? [])
        setLoading(false)
      })
  }, [clientId])

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      <p className="text-slate-400 text-sm mb-4">{tasks.length} tarefa(s) vinculada(s)</p>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhuma tarefa vinculada. Crie tarefas no módulo de Tarefas.
          </div>
        ) : (
          tasks.map((task) => {
            const priority = PRIORITY_BADGE[task.priority]
            const status = STATUS_BADGE[task.status]
            return (
              <div key={task.id} className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
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
                  <div className="flex gap-2 flex-shrink-0">
                    <Badge variant={priority.variant}>{priority.label}</Badge>
                    <Badge variant={status.variant}>{status.label}</Badge>
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
