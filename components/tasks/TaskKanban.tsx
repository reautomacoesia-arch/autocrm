'use client'

import { useState } from 'react'
import type { Client, Profile, Task, TaskStatus } from '@/lib/types'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { Plus } from 'lucide-react'

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'pending', label: 'Pendente', color: 'border-t-slate-500' },
  { key: 'in_progress', label: 'Em andamento', color: 'border-t-blue-500' },
  { key: 'done', label: 'Concluída', color: 'border-t-emerald-500' },
]

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-500',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'done') return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

interface TaskKanbanProps {
  tasks: Task[]
  clientMap: Record<string, string>
  profiles: Profile[]
  onTaskClick: (task: Task) => void
  onTaskMoved: (task: Task) => void
  onNewTask: (status: TaskStatus) => void
}

export default function TaskKanban({ tasks, clientMap, profiles, onTaskClick, onTaskMoved, onNewTask }: TaskKanbanProps) {
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null)

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDraggingId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd() {
    setDraggingId(null)
    setOverColumn(null)
  }

  function handleDragOver(e: React.DragEvent, col: TaskStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverColumn(col)
  }

  function handleDrop(e: React.DragEvent, col: TaskStatus) {
    e.preventDefault()
    setOverColumn(null)
    if (!draggingId) return
    const task = tasks.find((t) => t.id === draggingId)
    if (!task || task.status === col) return
    const updated = { ...task, status: col }
    onTaskMoved(updated)
    fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: col }),
    })
    setDraggingId(null)
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key)
        const isOver = overColumn === col.key

        return (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={() => setOverColumn(null)}
            onDrop={(e) => handleDrop(e, col.key)}
            className={`bg-[#111113] border rounded-xl p-3 min-h-[400px] transition-colors ${
              isOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800'
            }`}
          >
            {/* Column header */}
            <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color}`}>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-xs font-semibold">{col.label}</span>
                <span className="text-slate-600 text-xs bg-slate-800 px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              <button
                onClick={() => onNewTask(col.key)}
                className="text-slate-600 hover:text-indigo-400 transition-colors"
                title="Nova tarefa"
              >
                <Plus size={13} />
              </button>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {colTasks.map((task) => {
                const overdue = isOverdue(task.due_date, task.status)
                const isDragging = draggingId === task.id
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick(task)}
                    className={`bg-[#1a1a1d] border rounded-lg px-3 py-2.5 cursor-pointer transition-all select-none ${
                      isDragging ? 'opacity-40' : 'hover:border-slate-500'
                    } ${overdue ? 'border-red-800' : 'border-slate-700'}`}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${PRIORITY_DOT[task.priority]}`} />
                      <p className={`text-xs font-medium leading-snug flex-1 ${
                        task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'
                      }`}>
                        {task.title}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.client_id && clientMap[task.client_id] && (
                          <span className="text-slate-600 text-xs truncate max-w-[100px]">
                            {clientMap[task.client_id]}
                          </span>
                        )}
                        {task.tags?.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-indigo-400/70 text-xs">#{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {(() => {
                          const ids = task.assigned_to_ids?.length
                            ? task.assigned_to_ids
                            : task.assigned_to_id ? [task.assigned_to_id] : []
                          const assignees = ids.map((id) => profileMap[id]).filter(Boolean)
                          if (!assignees.length) return null
                          return (
                            <div className="flex -space-x-1">
                              {assignees.slice(0, 3).map((p) => (
                                <ProfileAvatar key={p.id} name={p.name} color={p.avatar_color} size="sm" />
                              ))}
                            </div>
                          )
                        })()}
                        {task.due_date && (
                          <span className={`text-xs ${overdue ? 'text-red-400' : 'text-slate-600'}`}>
                            {overdue ? '⚠ ' : ''}{formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
