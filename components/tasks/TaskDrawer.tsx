'use client'

import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import type { Profile, Task, TaskChecklistWithItems, TaskComment, TaskPriority, TaskStatus } from '@/lib/types'
import { X, Plus, Trash2, Check, Tag, GripVertical } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
import MultiAssigneeSelector from '@/components/team/MultiAssigneeSelector'
import { formatDuration } from '@/lib/duration'

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
  suggestedTags?: string[]
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
  suggestedTags = [],
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDrawerProps) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [checklists, setChecklists] = useState<TaskChecklistWithItems[]>([])
  const [newCheckItem, setNewCheckItem] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<TaskComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [localTask, setLocalTask] = useState<Task | null>(
    task ? { ...task, tags: task.tags ?? [] } : null
  )
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (!task) return
    // Normalize tags to [] for rows created before the migration
    setLocalTask({ ...task, tags: task.tags ?? [] })
    fetch(`/api/tasks/${task.id}/checklists`).then((r) => r.json()).then((d) => setChecklists(Array.isArray(d) ? d : []))
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

  async function addChecklist() {
    if (!localTask) return
    const res = await fetch(`/api/tasks/${localTask.id}/checklists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Checklist' }),
    })
    if (res.ok) {
      const created = await res.json()
      setChecklists((prev) => [...prev, created])
      setEditingChecklistId(created.id)
    } else {
      toast('Erro ao criar checklist', 'error')
    }
  }

  async function renameChecklist(checklistId: string, title: string) {
    const trimmed = title.trim()
    if (!trimmed || !localTask) return
    const previous = checklists
    setChecklists((prev) => prev.map((c) => (c.id === checklistId ? { ...c, title: trimmed } : c)))
    const res = await fetch(`/api/tasks/${localTask.id}/checklists/${checklistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    if (!res.ok) {
      setChecklists(previous)
      toast('Erro ao renomear checklist', 'error')
    }
  }

  async function deleteChecklist(checklistId: string) {
    if (!localTask) return
    const ok = await confirm({
      title: 'Excluir checklist?',
      description: 'Todos os itens dessa checklist serão removidos.',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    const previous = checklists
    setChecklists((prev) => prev.filter((c) => c.id !== checklistId))
    const res = await fetch(`/api/tasks/${localTask.id}/checklists/${checklistId}`, { method: 'DELETE' })
    if (!res.ok) {
      setChecklists(previous)
      toast('Erro ao remover checklist', 'error')
    }
  }

  async function addChecklistItem(checklistId: string) {
    if (!localTask) return
    const text = (newCheckItem[checklistId] ?? '').trim()
    if (!text) return
    setNewCheckItem((prev) => ({ ...prev, [checklistId]: '' }))
    const res = await fetch(`/api/tasks/${localTask.id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, checklist_id: checklistId }),
    })
    if (res.ok) {
      const item = await res.json()
      setChecklists((prev) =>
        prev.map((c) => (c.id === checklistId ? { ...c, items: [...c.items, item] } : c))
      )
    } else {
      toast('Erro ao adicionar item', 'error')
    }
  }

  async function toggleChecklistItem(checklistId: string, itemId: string, done: boolean) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, done: !done } : i)) }
          : c
      )
    )
    await fetch(`/api/tasks/${localTask!.id}/checklist/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    })
  }

  async function deleteChecklistItem(checklistId: string, itemId: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
      )
    )
    await fetch(`/api/tasks/${localTask!.id}/checklist/${itemId}`, { method: 'DELETE' })
  }

  async function renameChecklistItem(checklistId: string, itemId: string, text: string) {
    const trimmed = text.trim()
    if (!trimmed || !localTask) return
    const previous = checklists
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, text: trimmed } : i)) }
          : c
      )
    )
    const res = await fetch(`/api/tasks/${localTask.id}/checklist/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    })
    if (!res.ok) {
      setChecklists(previous)
      toast('Erro ao editar item', 'error')
    }
  }

  async function reorderChecklistItems(checklistId: string, items: TaskChecklistWithItems['items']) {
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, items } : c))
    )
    await fetch(`/api/tasks/${localTask!.id}/checklist/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist_id: checklistId, ids: items.map((i) => i.id) }),
    })
  }

  function handleChecklistDragEnd(result: DropResult) {
    const { source, destination } = result
    if (!destination) return
    if (source.droppableId !== destination.droppableId) return
    if (source.index === destination.index) return

    const checklist = checklists.find((c) => c.id === source.droppableId)
    if (!checklist) return

    const items = [...checklist.items]
    const [moved] = items.splice(source.index, 1)
    items.splice(destination.index, 0, moved)
    reorderChecklistItems(checklist.id, items)
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
              <p className="text-slate-500 text-xs mb-1">Responsáveis</p>
              <MultiAssigneeSelector
                profiles={profiles}
                value={localTask.assigned_to_ids ?? (localTask.assigned_to_id ? [localTask.assigned_to_id] : [])}
                onChange={(ids) => patchTask({ assigned_to_ids: ids })}
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
            {suggestedTags.filter((t) => !localTask.tags.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestedTags.filter((t) => !localTask.tags.includes(t)).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="text-xs px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Checklists */}
          <DragDropContext onDragEnd={handleChecklistDragEnd}>
          <div className="space-y-4">
            {checklists.map((cl) => {
              const doneCount = cl.items.filter((i) => i.done).length
              const total = cl.items.length
              return (
                <div key={cl.id} className="bg-[#050505] border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {editingChecklistId === cl.id ? (
                      <input
                        autoFocus
                        defaultValue={cl.title}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => {
                          setEditingChecklistId(null)
                          if (e.target.value.trim() && e.target.value.trim() !== cl.title) {
                            renameChecklist(cl.id, e.target.value)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                          if (e.key === 'Escape') { e.preventDefault(); setEditingChecklistId(null) }
                        }}
                        className="flex-1 bg-[#0a0a0c] border border-indigo-500 text-white rounded px-2 py-0.5 text-xs font-medium focus:outline-none"
                      />
                    ) : (
                      <p
                        onClick={() => setEditingChecklistId(cl.id)}
                        className="flex-1 text-slate-300 text-xs font-medium flex items-center gap-1 cursor-pointer hover:text-indigo-300 transition-colors"
                        title="Clique para renomear"
                      >
                        <Check size={10} className="text-slate-500" />
                        {cl.title}
                        {total > 0 && (
                          <span className="text-slate-600 ml-1">{doneCount}/{total}</span>
                        )}
                      </p>
                    )}
                    <button
                      onClick={() => deleteChecklist(cl.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remover checklist"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  {total > 0 && (
                    <div className="w-full bg-slate-800 rounded-full h-1 mb-3">
                      <div
                        className="bg-emerald-500 h-1 rounded-full transition-all"
                        style={{ width: `${(doneCount / total) * 100}%` }}
                      />
                    </div>
                  )}
                  <Droppable droppableId={cl.id}>
                    {(provided) => (
                      <div className="space-y-1.5 mb-2" ref={provided.innerRef} {...provided.droppableProps}>
                        {cl.items.map((item, idx) => (
                          <Draggable key={item.id} draggableId={item.id} index={idx}>
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className="flex items-center gap-2 group"
                              >
                                <span
                                  {...dragProvided.dragHandleProps}
                                  className="text-slate-700 hover:text-slate-500 cursor-grab flex-shrink-0"
                                >
                                  <GripVertical size={11} />
                                </span>
                                <button
                                  onClick={() => toggleChecklistItem(cl.id, item.id, item.done)}
                                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                                    item.done
                                      ? 'bg-emerald-600 border-emerald-600'
                                      : 'border-slate-600 hover:border-indigo-500'
                                  }`}
                                >
                                  {item.done && <Check size={9} className="text-white" />}
                                </button>
                                {editingItemId === item.id ? (
                                  <input
                                    autoFocus
                                    defaultValue={item.text}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => {
                                      setEditingItemId(null)
                                      if (e.target.value.trim() && e.target.value.trim() !== item.text) {
                                        renameChecklistItem(cl.id, item.id, e.target.value)
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                                      if (e.key === 'Escape') { e.preventDefault(); setEditingItemId(null) }
                                    }}
                                    className="flex-1 bg-[#0a0a0c] border border-indigo-500 text-white rounded px-1.5 py-0.5 text-xs focus:outline-none"
                                  />
                                ) : (
                                  <span
                                    onClick={() => setEditingItemId(item.id)}
                                    className={`flex-1 text-xs cursor-text hover:text-indigo-300 transition-colors ${item.done ? 'line-through text-slate-500' : 'text-slate-300'}`}
                                    title="Clique para editar"
                                  >
                                    {item.text}
                                  </span>
                                )}
                                <button
                                  onClick={() => deleteChecklistItem(cl.id, item.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCheckItem[cl.id] ?? ''}
                      onChange={(e) => setNewCheckItem((prev) => ({ ...prev, [cl.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(cl.id) } }}
                      placeholder="Novo item (Enter)"
                      className="flex-1 bg-[#0a0a0c] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                    />
                    <button
                      onClick={() => addChecklistItem(cl.id)}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
            <button
              onClick={addChecklist}
              className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-300 text-xs transition-colors"
            >
              <Plus size={12} /> Adicionar checklist
            </button>
          </div>
          </DragDropContext>

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
            {localTask.status === 'done' && localTask.completed_at && (
              <> • Concluída em {formatDatetime(localTask.completed_at)} (levou {formatDuration(localTask.created_at, localTask.completed_at)})</>
            )}
          </span>
          <button
            onClick={async () => {
              const res = await fetch(`/api/tasks/${localTask.id}`, { method: 'DELETE' })
              if (res.ok) {
                onTaskDeleted(localTask.id)
                onClose()
              } else {
                toast('Erro ao remover tarefa', 'error')
              }
            }}
            className="flex items-center gap-1.5 text-red-500 hover:text-red-400 text-xs transition-colors"
          >
            <Trash2 size={12} /> Excluir tarefa
          </button>
        </div>
      </div>
    </>
  )
}
