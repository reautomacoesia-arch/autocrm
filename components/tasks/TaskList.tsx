'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Client, Profile, Task, TaskPriority, TaskStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import CreateTaskModal from './CreateTaskModal'
import TaskKanban from './TaskKanban'
import TaskDrawer from './TaskDrawer'
import EmptyState from '@/components/ui/EmptyState'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { Download, Plus, LayoutGrid, List, Search, X, SlidersHorizontal, Check, Flag, Trash2, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
import { createClient } from '@/lib/supabase/client'
import { exportToExcel } from '@/lib/export-excel'
import { useBulkSelection, bulkRun } from '@/lib/hooks/useBulkSelection'
import { useNewParamModal } from '@/lib/hooks/useNewParamModal'
import BulkActionBar from '@/components/ui/BulkActionBar'
import { getSuggestedTags } from '@/lib/tags'
import { formatDuration } from '@/lib/duration'

const PRIORITY_BADGE: Record<TaskPriority, { label: string; variant: 'red' | 'yellow' | 'gray' }> = {
  high: { label: 'Alta', variant: 'red' },
  medium: { label: 'Média', variant: 'yellow' },
  low: { label: 'Baixa', variant: 'gray' },
}

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'pending',
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

type GroupBy = 'none' | 'status' | 'priority' | 'client'
type ViewMode = 'list' | 'kanban'
type SortBy = 'created_at' | 'priority' | 'due_date'

const SORT_LABELS: Record<SortBy, string> = {
  created_at: 'Mais recentes',
  priority: 'Prioridade',
  due_date: 'Vencimento',
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const GROUP_LABELS_PRIORITY: Record<string, string> = {
  high: 'Alta prioridade',
  medium: 'Média prioridade',
  low: 'Baixa prioridade',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'done') return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const taskDate = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return taskDate < today
}

interface TaskListProps {
  initialTasks: Task[]
  clients: Client[]
  onTaskAdded?: (task: Task) => void
}

export default function TaskList({ initialTasks, clients, onTaskAdded = () => {} }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  // Auto-abre o modal de nova tarefa quando a URL tem ?new=1 (ex.: launcher de comandos)
  const [isModalOpen, setIsModalOpen] = useNewParamModal('/tasks')
  const [modalDefaultStatus, setModalDefaultStatus] = useState<TaskStatus>('pending')
  const [filter, setFilter] = useState<TaskStatus | 'all' | 'mine'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [sortBy, setSortBy] = useState<SortBy>('created_at')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // ── advanced filters ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterDue, setFilterDue] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetch('/api/profiles').then((r) => r.json()).then((d) => setProfiles(Array.isArray(d) ? d : []))
  }, [])

  // Carrega o estilo de visualização salvo individualmente por perfil
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      try {
        const raw = localStorage.getItem(`tasks-view-pref:${user.id}`)
        if (!raw) return
        const pref = JSON.parse(raw)
        if (pref.viewMode === 'list' || pref.viewMode === 'kanban') setViewMode(pref.viewMode)
        if (['none', 'status', 'priority', 'client'].includes(pref.groupBy)) setGroupBy(pref.groupBy)
        if (['created_at', 'priority', 'due_date'].includes(pref.sortBy)) setSortBy(pref.sortBy)
      } catch {
        // ignora pref corrompida
      }
    })
  }, [])

  // Salva automaticamente o estilo de visualização sempre que mudar
  useEffect(() => {
    if (!userId) return
    try {
      localStorage.setItem(`tasks-view-pref:${userId}`, JSON.stringify({ viewMode, groupBy, sortBy }))
    } catch {
      // localStorage indisponível
    }
  }, [userId, viewMode, groupBy, sortBy])

  const { toast } = useToast()
  const confirm = useConfirm()
  const bulk = useBulkSelection()
  const [showBulkPriorityMenu, setShowBulkPriorityMenu] = useState(false)

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  // Collect unique tags from all tasks
  const allTags = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => (t.tags ?? []).forEach((tag) => set.add(tag)))
    return Array.from(set).sort()
  }, [tasks])

  // Count active advanced filters (not counting status tab)
  const advancedFilterCount = [search, filterAssignee, filterPriority, filterTag, filterDue].filter(Boolean).length
  const hasAdvancedFilters = advancedFilterCount > 0

  function clearFilters() {
    setSearch('')
    setFilterAssignee('')
    setFilterPriority('')
    setFilterTag('')
    setFilterDue('')
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const filtered = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    return tasks.filter((t) => {
      if (filter === 'mine') {
        const mine = !!userId && ((t.assigned_to_ids?.includes(userId)) || t.assigned_to_id === userId)
        if (!mine || t.status === 'done') return false
      } else if (filter !== 'all' && t.status !== filter) return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      if (filterAssignee && !(t.assigned_to_ids?.includes(filterAssignee) || t.assigned_to_id === filterAssignee)) return false
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterTag && !(t.tags ?? []).includes(filterTag)) return false
      if (filterDue === 'overdue' && !isOverdue(t.due_date, t.status)) return false
      if (filterDue === 'today' && t.due_date !== todayStr) return false
      if (filterDue === 'week' && (!t.due_date || t.due_date > weekEndStr)) return false
      return true
    })
  }, [tasks, filter, search, filterAssignee, filterPriority, filterTag, filterDue, userId])

  // Ordena: tarefas concluídas sempre vão para o fim; dentro de cada grupo, aplica o critério escolhido
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0
      const bDone = b.status === 'done' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone

      if (sortBy === 'priority') {
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      }
      if (sortBy === 'due_date') {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      }
      return b.created_at.localeCompare(a.created_at)
    })
    return arr
  }, [filtered, sortBy])

  // Tags sugeridas (mais usadas) para facilitar a marcação de novas tarefas
  const suggestedTags = useMemo(() => getSuggestedTags(tasks), [tasks])

  // Quantas tarefas estão atribuídas a mim e ainda não concluídas (aba "Minhas")
  const myPendingCount = useMemo(
    () => tasks.filter(
      (t) => !!userId && ((t.assigned_to_ids?.includes(userId)) || t.assigned_to_id === userId) && t.status !== 'done'
    ).length,
    [tasks, userId]
  )

  interface TaskGroup { key: string; label: string; tasks: Task[] }

  function computeGroups(items: Task[]): TaskGroup[] {
    if (groupBy === 'none') return []
    if (groupBy === 'status') {
      const order: TaskStatus[] = ['pending', 'in_progress', 'done']
      return order
        .map((s) => ({ key: s, label: STATUS_LABEL[s], tasks: items.filter((t) => t.status === s) }))
        .filter((g) => g.tasks.length > 0)
    }
    if (groupBy === 'priority') {
      const order: TaskPriority[] = ['high', 'medium', 'low']
      return order
        .map((p) => ({ key: p, label: GROUP_LABELS_PRIORITY[p], tasks: items.filter((t) => t.priority === p) }))
        .filter((g) => g.tasks.length > 0)
    }
    if (groupBy === 'client') {
      const map = new Map<string, Task[]>()
      for (const t of items) {
        const key = t.client_id ?? '__none__'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(t)
      }
      return Array.from(map.entries())
        .map(([key, items]) => ({
          key,
          label: key === '__none__' ? 'Sem cliente' : (clientMap[key] ?? 'Cliente removido'),
          tasks: items,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    }
    return []
  }

  const groups = computeGroups(sorted)

  function handleExport() {
    exportToExcel(
      'tarefas',
      sorted.map((t) => {
        const ids = t.assigned_to_ids?.length
          ? t.assigned_to_ids
          : t.assigned_to_id ? [t.assigned_to_id] : []
        const assigneeNames = ids
          .map((id) => profiles.find((p) => p.id === id)?.name)
          .filter(Boolean)
          .join(', ')
        return {
          Título: t.title,
          Status: STATUS_LABEL[t.status],
          Prioridade: PRIORITY_BADGE[t.priority].label,
          Vencimento: formatDate(t.due_date),
          Cliente: t.client_id ? (clientMap[t.client_id] ?? '') : '',
          Responsáveis: assigneeNames,
          Tags: (t.tags ?? []).join(', '),
        }
      }),
      'Tarefas',
    )
  }

  async function advanceStatus(task: Task) {
    const next = STATUS_NEXT[task.status]
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
  }

  async function deleteTask(id: string) {
    const ok = await confirm({
      title: 'Remover esta tarefa?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    toast('Tarefa removida')
  }

  async function bulkComplete() {
    const ids = Array.from(bulk.selected)
    if (ids.length === 0) return
    setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, status: 'done' } : t)))
    const { fail } = await bulkRun(ids, (id) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      }),
    )
    if (fail > 0) toast(`${fail} tarefa(s) não puderam ser concluídas`, 'error')
    else toast(`${ids.length} tarefa(s) concluída(s)`)
    bulk.clear()
  }

  async function bulkSetPriority(priority: TaskPriority) {
    const ids = Array.from(bulk.selected)
    if (ids.length === 0) return
    setShowBulkPriorityMenu(false)
    setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, priority } : t)))
    const { fail } = await bulkRun(ids, (id) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      }),
    )
    if (fail > 0) toast(`${fail} tarefa(s) não puderam ser atualizadas`, 'error')
    else toast(`Prioridade de ${ids.length} tarefa(s) atualizada para ${PRIORITY_BADGE[priority].label}`)
    bulk.clear()
  }

  async function bulkDelete() {
    const ids = Array.from(bulk.selected)
    if (ids.length === 0) return
    const ok = await confirm({
      title: `Remover ${ids.length} tarefa${ids.length !== 1 ? 's' : ''}?`,
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
    const { fail } = await bulkRun(ids, (id) => fetch(`/api/tasks/${id}`, { method: 'DELETE' }))
    if (fail > 0) toast(`${fail} tarefa(s) não puderam ser removidas`, 'error')
    else toast(`${ids.length} tarefa(s) removida(s)`)
    bulk.clear()
  }

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [task, ...prev])
    onTaskAdded(task)
    setIsModalOpen(false)
  }

  function handleTaskUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    if (selectedTask?.id === updated.id) setSelectedTask(updated)
  }

  function handleTaskDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    toast('Tarefa removida')
  }

  async function handleSaveTitle(taskId: string) {
    if (!editingTitle.trim()) { setEditingTitleId(null); return }
    const newTitle = editingTitle.trim()
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title: newTitle } : t)))
    setEditingTitleId(null)
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
  }

  function openNewTaskModal(status: TaskStatus = 'pending') {
    setModalDefaultStatus(status)
    setIsModalOpen(true)
  }

  function renderTask(task: Task) {
    const overdue = isOverdue(task.due_date, task.status)
    const priority = PRIORITY_BADGE[task.priority]

    return (
      <div
        key={task.id}
        onClick={() => setSelectedTask(task)}
        className={`flex items-start gap-3 bg-[#1a1a1d] border rounded-lg px-4 py-3 cursor-pointer hover:border-slate-500 transition-colors ${
          overdue ? 'border-red-800 hover:border-red-700' : 'border-slate-700'
        }`}
      >
        <input
          type="checkbox"
          checked={bulk.isSelected(task.id)}
          onChange={() => bulk.toggle(task.id)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex-shrink-0 w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          aria-label="Selecionar tarefa"
        />
        <button
          onClick={(e) => { e.stopPropagation(); advanceStatus(task) }}
          title={task.status === 'done' ? 'Reabrir tarefa' : `Avançar para ${STATUS_LABEL[STATUS_NEXT[task.status]]}`}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors ${
            task.status === 'done'
              ? 'bg-emerald-600 border-emerald-600 hover:bg-red-600 hover:border-red-600'
              : task.status === 'in_progress'
              ? 'border-blue-500 bg-blue-500/20'
              : 'border-slate-600 hover:border-indigo-500'
          }`}
        />
        <div className="flex-1 min-w-0">
          {editingTitleId === task.id ? (
            <input
              autoFocus
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => handleSaveTitle(task.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle(task.id) }
                if (e.key === 'Escape') setEditingTitleId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#050505] border border-indigo-500 text-white rounded px-2 py-0.5 text-sm font-medium w-full focus:outline-none"
            />
          ) : (
            <p
              className={`text-sm font-medium break-words ${
                task.status === 'done' ? 'line-through text-slate-500' : 'text-white'
              }`}
            >
              {task.title}
            </p>
          )}
          {task.description && (
            <p className="text-slate-400 text-xs mt-0.5 break-words line-clamp-2">{task.description}</p>
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
            {(() => {
              const ids = task.assigned_to_ids?.length
                ? task.assigned_to_ids
                : task.assigned_to_id ? [task.assigned_to_id] : []
              if (!ids.length) return null
              const assignees = ids
                .map((id) => profiles.find((p) => p.id === id))
                .filter(Boolean) as typeof profiles
              if (!assignees.length) return null
              return (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <div className="flex -space-x-1">
                    {assignees.slice(0, 3).map((p) => (
                      <ProfileAvatar key={p.id} name={p.name} color={p.avatar_color} avatarUrl={p.avatar_url} size="sm" />
                    ))}
                  </div>
                  {assignees.length === 1 ? assignees[0].name : `${assignees.length} responsáveis`}
                </span>
              )
            })()}
            {task.tags?.map((tag) => (
              <span key={tag} className="text-indigo-400/70 text-xs">#{tag}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {task.status === 'done' && task.completed_at && (
            <span className="text-slate-500 text-xs" title="Tempo até a conclusão">
              ⏱ {formatDuration(task.created_at, task.completed_at)}
            </span>
          )}
          <Badge variant={priority.variant}>{priority.label}</Badge>
          <Badge variant={STATUS_VARIANT[task.status]}>{STATUS_LABEL[task.status]}</Badge>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'mine', 'pending', 'in_progress', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-[#050505]'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all'
                ? `Todas (${tasks.length})`
                : f === 'mine'
                ? `Minhas (${myPendingCount})`
                : STATUS_LABEL[f as TaskStatus]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="Lista"
            >
              <List size={13} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'kanban' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              title="Kanban"
            >
              <LayoutGrid size={13} />
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            title="Ordenar por"
            className="bg-[#1a1a1d] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
          >
            {(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
              <option key={key} value={key}>Ordenar: {SORT_LABELS[key]}</option>
            ))}
          </select>

          {viewMode === 'list' && (
            <select
              value={groupBy}
              onChange={(e) => { setGroupBy(e.target.value as GroupBy); setCollapsedGroups(new Set()) }}
              className="bg-[#1a1a1d] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="none">Sem agrupamento</option>
              <option value="status">Por status</option>
              <option value="priority">Por prioridade</option>
              <option value="client">Por cliente</option>
            </select>
          )}

          <button
            onClick={handleExport}
            disabled={sorted.length === 0}
            className="flex items-center gap-1.5 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-xs transition-colors"
          >
            <Download size={13} />
            Exportar Excel
          </button>

          <button
            onClick={() => openNewTaskModal()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="mb-4">
        {/* Toggle + search row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar tarefas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1a1a1d] border border-slate-700 text-white rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X size={11} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showFilters || hasAdvancedFilters
                ? 'border-indigo-500 bg-indigo-600/10 text-indigo-400'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <SlidersHorizontal size={12} />
            Filtros
            {advancedFilterCount > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {advancedFilterCount}
              </span>
            )}
          </button>
          {hasAdvancedFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
              <X size={11} /> Limpar filtros
            </button>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-2 p-3 bg-[#1a1a1d] border border-slate-700 rounded-lg">
            {/* Responsible */}
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-[#050505] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="">Responsável: Todos</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Priority */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-[#050505] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="">Prioridade: Todas</option>
              <option value="high">🔴 Alta</option>
              <option value="medium">🟡 Média</option>
              <option value="low">⚪ Baixa</option>
            </select>

            {/* Tag */}
            {allTags.length > 0 && (
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="bg-[#050505] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">Tag: Todas</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>#{tag}</option>
                ))}
              </select>
            )}

            {/* Due date */}
            <select
              value={filterDue}
              onChange={(e) => setFilterDue(e.target.value)}
              className="bg-[#050505] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="">Prazo: Qualquer</option>
              <option value="overdue">⚠ Em atraso</option>
              <option value="today">📅 Vence hoje</option>
              <option value="week">📆 Esta semana</option>
            </select>
          </div>
        )}

        {/* Results count when filtering */}
        {hasAdvancedFilters && (
          <p className="text-slate-500 text-xs mt-2">
            {sorted.length} tarefa{sorted.length !== 1 ? 's' : ''} encontrada{sorted.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {viewMode === 'kanban' ? (
        <TaskKanban
          tasks={sorted}
          clientMap={clientMap}
          profiles={profiles}
          onTaskClick={setSelectedTask}
          onTaskMoved={handleTaskUpdated}
          onNewTask={openNewTaskModal}
        />
      ) : (
        <div>
          <BulkActionBar count={bulk.count} onClear={bulk.clear}>
            <button
              onClick={bulkComplete}
              className="border border-slate-700 text-slate-300 hover:text-white rounded-md px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
            >
              <Check size={13} />
              Concluir
            </button>
            <div className="relative">
              <button
                onClick={() => setShowBulkPriorityMenu((v) => !v)}
                className="border border-slate-700 text-slate-300 hover:text-white rounded-md px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
              >
                <Flag size={13} />
                Prioridade
                <ChevronDown size={12} />
              </button>
              {showBulkPriorityMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#1a1a1d] border border-slate-700 rounded-md shadow-lg z-10 min-w-[120px] overflow-hidden">
                  {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => bulkSetPriority(p)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                    >
                      {PRIORITY_BADGE[p].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={bulkDelete}
              className="border border-red-800/60 text-red-400 hover:text-red-300 rounded-md px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={13} />
              Excluir
            </button>
          </BulkActionBar>

          {sorted.length > 0 && (
            <label className="flex items-center gap-2 mb-2 text-xs text-slate-500 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={bulk.allSelected(sorted.map((t) => t.id))}
                onChange={() => bulk.toggleAll(sorted.map((t) => t.id))}
                className="w-4 h-4 rounded border-slate-600 bg-[#050505] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              Selecionar todos
            </label>
          )}

          <div className="space-y-2">
          {sorted.length === 0 ? (
            filter === 'all' ? (
              <EmptyState
                icon="✅"
                title="Nenhuma tarefa ainda"
                description="Crie tarefas para acompanhar o que precisa ser feito."
                action={{ label: '+ Nova Tarefa', onClick: () => openNewTaskModal() }}
              />
            ) : filter === 'mine' ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Nenhuma tarefa pendente atribuída a você 🎉
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-sm">
                Nenhuma tarefa "{STATUS_LABEL[filter as TaskStatus]}".
              </div>
            )
          ) : groupBy !== 'none' ? (
            groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key)
              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center gap-2 py-2 text-left"
                  >
                    <span className={`text-slate-500 text-xs transition-transform inline-block ${isCollapsed ? '' : 'rotate-90'}`}>›</span>
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                    <span className="text-slate-600 text-xs bg-slate-800 px-2 py-0.5 rounded-full">{group.tasks.length}</span>
                    <div className="flex-1 h-px bg-slate-800 ml-1" />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-2">
                      {group.tasks.map((task) => renderTask(task))}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            sorted.map((task) => renderTask(task))
          )}
          </div>
        </div>
      )}

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clients={clients}
        profiles={profiles}
        onTaskCreated={handleTaskCreated}
        defaultStatus={modalDefaultStatus}
        suggestedTags={suggestedTags}
      />

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          clientName={selectedTask.client_id ? clientMap[selectedTask.client_id] : undefined}
          profiles={profiles}
          suggestedTags={suggestedTags}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />
      )}
    </>
  )
}
