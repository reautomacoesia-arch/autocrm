import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pipeline'
import MetricCard from '@/components/dashboard/MetricCard'
import Link from 'next/link'

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

const TYPE_ICON: Record<string, string> = {
  note: '📝',
  meeting: '📞',
  email: '✉️',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
  }
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatDatetime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day) < new Date(new Date().toDateString())
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const [
    clientsRes,
    leadsRes,
    proposalsRes,
    tasksRes,
    tasksDueRes,
    interactionsRes,
  ] = await Promise.all([
    supabase.from('clients').select('id, monthly_value').eq('status', 'active'),
    supabase
      .from('leads')
      .select('id')
      .not('stage', 'in', '("won","lost")'),
    supabase
      .from('proposals')
      .select('id, value')
      .in('status', ['draft', 'sent']),
    supabase
      .from('tasks')
      .select('id')
      .neq('status', 'done'),
    supabase
      .from('tasks')
      .select('id, title, priority, status, due_date, clients(name)')
      .neq('status', 'done')
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .limit(5),
    supabase
      .from('interactions')
      .select('id, type, description, happened_at, clients(name)')
      .order('happened_at', { ascending: false })
      .limit(5),
  ])

  const clients = clientsRes.data ?? []
  const mrr = clients.reduce((sum: number, c: any) => sum + (c.monthly_value ?? 0), 0)
  const leadsCount = leadsRes.data?.length ?? 0
  const openProposals = proposalsRes.data ?? []
  const openProposalsValue = openProposals.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0)
  const pendingTasksCount = tasksRes.data?.length ?? 0
  const tasksDue = tasksDueRes.data ?? []
  const overdueCount = tasksDue.filter((t: any) => isOverdue(t.due_date)).length
  const recentInteractions = interactionsRes.data ?? []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="MRR"
          value={formatCurrency(mrr)}
          sub={`${clients.length} cliente(s) ativo(s)`}
          color="green"
        />
        <MetricCard
          label="Leads ativos"
          value={String(leadsCount)}
          sub="no pipeline"
          color="indigo"
        />
        <MetricCard
          label="Propostas abertas"
          value={String(openProposals.length)}
          sub={openProposalsValue > 0 ? `${formatCurrency(openProposalsValue)} em jogo` : undefined}
          color="amber"
        />
        <MetricCard
          label="Tarefas pendentes"
          value={String(pendingTasksCount)}
          sub={overdueCount > 0 ? `${overdueCount} em atraso` : undefined}
          color={pendingTasksCount > 0 ? 'amber' : 'white'}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Tasks due today / overdue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Tarefas para hoje
            </h2>
            <Link
              href="/tasks"
              className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
            >
              Ver todas →
            </Link>
          </div>
          {tasksDue.length === 0 ? (
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
              Nenhuma tarefa pendente 🎉
            </div>
          ) : (
            <div className="space-y-2">
              {tasksDue.map((task: any) => {
                const overdue = isOverdue(task.due_date)
                return (
                  <div
                    key={task.id}
                    className={`bg-[#1e293b] border rounded-lg px-4 py-3 ${
                      overdue ? 'border-red-800' : 'border-slate-700'
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
                        <span className={`text-xs font-medium ${PRIORITY_COLOR[task.priority]}`}>
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                        {task.due_date && (
                          <span className={`text-xs ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                            {overdue ? '⚠ ' : ''}{formatDate(task.due_date)}
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

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Atividade recente
            </h2>
          </div>
          {recentInteractions.length === 0 ? (
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
              Nenhuma interação registrada ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {recentInteractions.map((interaction: any) => (
                <div
                  key={interaction.id}
                  className="bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0 mt-0.5">
                      {TYPE_ICON[interaction.type] ?? '📝'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-sm truncate">{interaction.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {interaction.clients && (
                          <p className="text-slate-500 text-xs">{interaction.clients.name}</p>
                        )}
                        <p className="text-slate-600 text-xs">
                          {formatDatetime(interaction.happened_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
