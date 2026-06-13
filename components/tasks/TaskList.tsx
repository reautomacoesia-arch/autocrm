'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Client, Profile, Task, TaskPriority, TaskStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import CreateTaskModal from './CreateTaskModal'
import TaskKanban from './TaskKanban'
import TaskDrawer from './TaskDrawer'
import EmptyState from '@/components/ui/EmptyState'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { Plus, LayoutGrid, List, Search, X, SlidersHorizontal } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [profiles, setProfiles] = useState<Profile[]>([])
  // Auto-abre o modal de nova tarefa quando a URL tem ?new=1 (ex.: launcher de comandos)
  const [isModalOpen, setIsModalOpen] = useState(() => searchParams.get('new') === '1')
  const [modalDefaultStatus, setModalDefaultStatus] = useState<TaskStatus>('pending')
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
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

  // Limpa o ?new=1 da URL para não reabrir o modal em navegações futuras
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      router.replace('/tasks')
    }
  }, [searchParams, router])

  const { toast } = useToast()
  const confirm = useConfirm()

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
      if (filter !== 'all' && t.status !== filter) return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      if (filterAssignee && !(t.assigned_to_ids?.includes(filterAssignee) || t.assigned_to_id === filterAssignee)) return false
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterTag && !(t.tags ?? []).includes(filterTag)) return false
      if (filterDue === 'overdue' && !isOverdue(t.due_date, t.status)) return false
      if (filterDue === 'today' && t.due_date !== todayStr) return false
      if (filterDue === 'week' && (!t.due_date || t.due_date > weekEndStr)) return false
      return true
    })
  }, [tasks, filter, search, filterAssignee, filterPriority, filterTag, filterDue])

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

  const groups = computeGroups(filtered)

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
              className={`text-sm font-medium ${
                task.status === 'done' ? 'line-through text-slate-500' : 'text-white'
              }`}
            >
              {task.title}
            </p>
          )}
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
          {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-[#050505]'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all' ? `Todas (${tasks.length})` : STATUS_LABEL[f as TaskStatus]}
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
            {filtered.length} tarefa{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {viewMode === 'kanban' ? (
        <TaskKanban
          tasks={tasks}
          clientMap={clientMap}
          profiles={profiles}
          onTaskClick={setSelectedTask}
          onTaskMoved={handleTaskUpdated}
          onNewTask={openNewTaskModal}
        />
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            filter === 'all' ? (
              <EmptyState
                icon="✅"
                title="Nenhuma tarefa ainda"
                description="Crie tarefas para acompanhar o que precisa ser feito."
                action={{ label: '+ Nova Tarefa', onClick: () => openNewTaskModal() }}
              />
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
            filtered.map((task) => renderTask(task))
          )}
        </div>
      )}

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clients={clients}
        profiles={profiles}
        onTaskCreated={handleTaskCreated}
        defaultStatus={modalDefaultStatus}
      />

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          clientName={selectedTask.client_id ? clientMap[selectedTask.client_id] : undefined}
          profiles={profiles}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />
      )}
    </>
  )
}
