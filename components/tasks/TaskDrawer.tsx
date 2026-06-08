'use client'

import { useEffect, useRef, useState } from 'react'
import type { Profile, Task, TaskChecklistItem, TaskComment, TaskPriority, TaskStatus } from '@/lib/types'
import { X, Plus, Trash2, Check, Tag } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import AssigneeSelector from '@/components/team/AssigneeSelector'

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

interface TaskDrawerProps {
  task: Task | null
  clientName?: string
  profiles: Profile[]
  onClose: () => void
  onTaskUpdated: (task: Task) => void
  onTaskDeleted: (id: string) => void
}

function formatDatetime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TaskDrawer({
  task,
  clientName,
  profiles,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDrawerProps) {
  const { toast } = useToast()
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [newCheckItem, setNewCheckItem] = useState('')
  const [newComment, setNewComment] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [localTask, setLocalTask] = useState<Task | null>(
    task ? { ...task, tags: task.tags ?? [] } : null
  )
  const [tagInput, setTagInput] = useState('')
  const checkInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!task) return
    // Normalize tags to [] for rows created before the migration
    setLocalTask({ ...task, tags: task.tags ?? [] })
    fetch(`/api/tasks/${task.id}/checklist`).then((r) => r.json()).then((d) => setChecklist(Array.isArray(d) ? d : []))
    fetch(`/api/tasks/${task.id}/comments`).then((r) => r.json()).then((d) => setComments(Array.isArray(d) ? d : []))
  }, [task?.id])

  if (!task || !localTask) return null

  async function patchTask(fields: Partial<Task>) {
    const current = localTask
    if (!current) return
    const updated = { ...current, ...fields }
    setLocalTask(updated)
    const res = await fetch(`/api/tasks/${current.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (res.ok) {
      const data = await res.json()
      setLocalTask(data)
      onTaskUpdated(data)
    }
  }

  async function addChecklistItem() {
    if (!newCheckItem.trim() || !localTask) return
    const text = newCheckItem.trim()
    setNewCheckItem('')
    const res = await fetch(`/api/tasks/${localTask.id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (res.ok) {
      const item = await res.json()
      setChecklist((prev) => [...prev, item])
    }
  }

  async function toggleChecklistItem(item: TaskChecklistItem) {
    const updated = { ...item, done: !item.done }
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
    await fetch(`/api/tasks/${localTask!.id}/checklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !item.done }),
    })
  }

  async function deleteChecklistItem(id: string) {
    setChecklist((prev) => prev.filter((i) => i.id !== id))
    await fetch(`/api/tasks/${localTask!.id}/checklist/${id}`, { method: 'DELETE' })
  }

  async function addComment() {
    if (!newComment.trim() || !localTask) return
    const body = newComment.trim()
    setNewComment('')
    const res = await fetch(`/api/tasks/${localTask.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (res.ok) {
      const comment = await res.json()
      setComments((prev) => [...prev, comment])
    }
  }

  async function deleteComment(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/tasks/${localTask!.id}/comments/${id}`, { method: 'DELETE' })
  }

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase()
    if (!t || !localTask || localTask.tags.includes(t)) return
    const tags = [...localTask.tags, t]
    patchTask({ tags })
  }

  function removeTag(tag: string) {
    if (!localTask) return
    const tags = localTask.tags.filter((t) => t !== tag)
    patchTask({ tags })
  }

  const doneCount = checklist.filter((i) => i.done).length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-[#1a1a1d] border-l border-slate-700 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-700">
          <div className="flex-1 min-w-0">
            {editingField === 'title' ? (
              <input
                autoFocus
                defaultValue={localTask.title}
                onBlur={(e) => {
                  setEditingField(null)
                  if (e.target.value.trim()) patchTask({ title: e.target.value.trim() })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                  if (e.key === 'Escape') setEditingField(null)
                }}
                className="w-full bg-[#050505] border border-indigo-500 text-white rounded px-2 py-1 text-sm font-semibold focus:outline-none"
              />
            ) : (
              <h2
                onClick={() => setEditingField('title')}
                className={`text-white font-semibold text-sm leading-snug cursor-pointer hover:text-indigo-300 transition-colors ${
                  localTask.status === 'done' ? 'line-through text-slate-400' : ''
                }`}
                title="Clique para editar"
              >
                {localTask.title}
              </h2>
            )}
            {clientName && (
              <p className="text-slate-500 text-xs mt-0.5">{clientName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-slate-500 text-xs mb-1">Status</p>
              <select
                value={localTask.status}
                onChange={(e) => patchTask({ status: e.target.value as TaskStatus })}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="pending">Pendente</option>
                <option value="in_progress">Em andamento</option>
                <option value="done">Concluída</option>
              </select>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Prioridade</p>
              <select
                value={localTask.priority}
                onChange={(e) => patchTask({ priority: e.target.value as TaskPriority })}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Vencimento</p>
              <input
                type="date"
                value={localTask.due_date ?? ''}
                onChange={(e) => patchTask({ due_date: e.target.value || null })}
                className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Responsável</p>
              <AssigneeSelector
                profiles={profiles}
                value={localTask.assigned_to_id ?? null}
                onChange={(id, name) => patchTask({ assigned_to_id: id, assigned_to: name })}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-slate-500 text-xs mb-1">Descrição</p>
            <textarea
              value={localTask.description ?? ''}
              onChange={(e) => setLocalTask((p) => p ? { ...p, description: e.target.value } : p)}
              onBlur={(e) => patchTask({ description: e.target.value || null })}
              rows={3}
              placeholder="Adicionar descrição..."
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600"
            />
          </div>

          {/* Tags */}
          <div>
            <p className="text-slate-500 text-xs mb-2 flex items-center gap-1"><Tag size={10} /> Tags</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {localTask.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 bg-indigo-600/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); setTagInput('') }
                }}
                placeholder="Adicionar tag (Enter)"
                className="flex-1 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
              />
              <button
                onClick={() => { addTag(tagInput); setTagInput('') }}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-500 text-xs flex items-center gap-1">
                <Check size={10} /> Checklist
                {checklist.length > 0 && (
                  <span className="text-slate-600 ml-1">{doneCount}/{checklist.length}</span>
                )}
              </p>
            </div>
            {checklist.length > 0 && (
              <div className="w-full bg-slate-800 rounded-full h-1 mb-3">
                <div
                  className="bg-emerald-500 h-1 rounded-full transition-all"
                  style={{ width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%` }}
                />
              </div>
            )}
            <div className="space-y-1.5 mb-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleChecklistItem(item)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      item.done
                        ? 'bg-emerald-600 border-emerald-600'
                        : 'border-slate-600 hover:border-indigo-500'
                    }`}
                  >
                    {item.done && <Check size={9} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-xs ${item.done ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                ref={checkInputRef}
                type="text"
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                placeholder="Novo item (Enter)"
                className="flex-1 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
              />
              <button
                onClick={addChecklistItem}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Comments */}
          <div>
            <p className="text-slate-500 text-xs mb-2">Comentários {comments.length > 0 && `(${comments.length})`}</p>
            <div className="space-y-2 mb-3">
              {comments.map((c) => (
                <div key={c.id} className="bg-[#050505] border border-slate-800 rounded-lg px-3 py-2 group">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-indigo-400 text-xs font-medium">{c.author}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-xs">{formatDatetime(c.created_at)}</span>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-300 text-xs mt-1 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() }
                }}
                rows={2}
                placeholder="Adicionar comentário (Enter para enviar)"
                className="flex-1 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600"
              />
              <button
                onClick={addComment}
                className="bg-indigo-600 hover:bg-indigo-500 text-[#050505] rounded-lg px-3 text-xs font-medium transition-colors self-end py-2"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 flex items-center justify-between">
          <span className="text-slate-600 text-xs">
            Criada em {formatDatetime(localTask.created_at)}
          </span>
          <button
            onClick={() => { onTaskDeleted(localTask.id); onClose() }}
            className="flex items-center gap-1.5 text-red-500 hover:text-red-400 text-xs transition-colors"
          >
            <Trash2 size={12} /> Excluir tarefa
          </button>
        </div>
      </div>
    </>
  )
}
