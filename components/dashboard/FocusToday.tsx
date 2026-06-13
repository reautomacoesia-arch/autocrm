import Link from 'next/link'
import Card from '@/components/ui/Card'
import type { Task } from '@/lib/types'
import { formatDate } from '@/lib/format-date'

const PRIORITY_COLOR: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-slate-400',
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

interface TaskWithClient extends Task {
  clients?: { name: string } | null
}

interface FocusTodayProps {
  overdueTasks: TaskWithClient[]
  dueTodayTasks: TaskWithClient[]
}

export default function FocusToday({ overdueTasks, dueTodayTasks }: FocusTodayProps) {
  const items = [...overdueTasks, ...dueTodayTasks]
  const isEmpty = items.length === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
          Foco do dia
        </h2>
      </div>

      {!isEmpty && (
        <div className="flex items-center gap-2 mb-3">
          {overdueTasks.length > 0 && (
            <Link
              href="/tasks"
              className="bg-red-500/10 text-red-400 border border-red-800/50 text-xs font-medium px-3 py-1 rounded-full hover:bg-red-500/20 transition-colors"
            >
              {overdueTasks.length} em atraso
            </Link>
          )}
          {dueTodayTasks.length > 0 && (
            <Link
              href="/tasks"
              className="bg-amber-500/10 text-amber-400 border border-amber-800/50 text-xs font-medium px-3 py-1 rounded-full hover:bg-amber-500/20 transition-colors"
            >
              {dueTodayTasks.length} para hoje
            </Link>
          )}
        </div>
      )}

      {isEmpty ? (
        <Card className="p-6 text-center">
          <p className="text-white text-sm font-medium">Tudo em dia 🎉</p>
          <Link
            href="/tasks"
            className="inline-block mt-2 text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
          >
            Ver todas as tarefas →
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((task) => {
            const overdue = overdueTasks.includes(task)
            return (
              <div
                key={task.id}
                className={`bg-[#1a1a1d] border rounded-lg px-4 py-3 ${
                  overdue ? 'border-red-800/70' : 'border-amber-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{task.title}</p>
                    {task.clients && (
                      <p className="text-slate-500 text-xs mt-0.5">{task.clients.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-medium ${PRIORITY_COLOR[task.priority] ?? ''}`}>
                      {PRIORITY_LABEL[task.priority] ?? task.priority}
                    </span>
                    {task.due_date && (
                      <span className={`text-xs ${overdue ? 'text-red-400' : 'text-amber-400'}`}>
                        {overdue ? '⚠ ' : '📅 '}{formatDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
