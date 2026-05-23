'use client'

import { useState } from 'react'
import type { Client, Task, TaskPriority, TaskStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import CreateTaskModal from './CreateTaskModal'
import { Plus, Trash2 } from 'lucide-react'

const PRIORITY_BADGE: Record<TaskPriority, { label: string; variant: 'red' | 'yellow' | 'gray' }> = {
  high: { label: 'Alta', variant: 'red' },
  medium: { label: 'Média', variant: 'yellow' },
  low: { label: 'Baixa', variant: 'gray' },
}

const STATUS_NEXT: Record<TaskStatus, TaskStatus | null> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: null,
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
}

const STATUS_VARIANT: Record<TaskStatus, 'gray' | 'blue' | 'green'> = {
  pending: 'gray',
  in_progress: 'blue',
  done: 'green',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'done') return false
  return new Date(dateStr) < new Date()
}

interface TaskListProps {
  initialTasks: Task[]
  clients: Client[]
  onTaskAdded?: (task: Task) => void
}

export default function TaskList({ initialTasks, clients, onTaskAdded = () => {} }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  async function advanceStatus(task: Task) {
    const next = STATUS_NEXT[task.status]
    if (!next) return

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [task, ...prev])
    onTaskAdded(task)
    setIsModalOpen(false)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all' ? `Todas (${tasks.length})` : STATUS_LABEL[f as TaskStatus]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nova Tarefa
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {filter === 'all'
              ? 'Nenhuma tarefa pendente.'
              : `Nenhuma tarefa "${STATUS_LABEL[filter as TaskStatus]}".`}
          </div>
        ) : (
          filtered.map((task) => {
            const overdue = isOverdue(task.due_date, task.status)
            const priority = PRIORITY_BADGE[task.priority]
            const nextStatus = STATUS_NEXT[task.status]

            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 bg-[#1e293b] border rounded-lg px-4 py-3 ${
                  overdue ? 'border-red-800' : 'border-slate-700'
                }`}
              >
                <button
                  onClick={() => advanceStatus(task)}
                  disabled={!nextStatus}
                  title={nextStatus ? `Avançar para ${STATUS_LABEL[nextStatus]}` : 'Concluída'}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors ${
                    task.status === 'done'
                      ? 'bg-emerald-600 border-emerald-600'
                      : task.status === 'in_progress'
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-slate-600 hover:border-indigo-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      task.status === 'done' ? 'line-through text-slate-500' : 'text-white'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-slate-400 text-xs mt-0.5 truncate">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {task.due_date && (
                      <span className={`text-xs ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                        {overdue ? '⚠ ' : ''}Vence: {formatDate(task.due_date)}
                      </span>
                    )}
                    {task.client_id && clientMap[task.client_id] && (
                      <span className="text-xs text-slate-500">• {clientMap[task.client_id]}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={priority.variant}>{priority.label}</Badge>
                  <Badge variant={STATUS_VARIANT[task.status]}>{STATUS_LABEL[task.status]}</Badge>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors ml-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clients={clients}
        onTaskCreated={handleTaskCreated}
      />
    </>
  )
}
