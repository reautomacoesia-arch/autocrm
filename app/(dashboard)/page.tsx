import { createClient } from '@/lib/supabase/server'
import { formatCurrency, STAGE_LABELS } from '@/lib/pipeline'
import MetricCard from '@/components/dashboard/MetricCard'
import Link from 'next/link'
import DashboardCalendar from '@/components/dashboard/DashboardCalendar'
import type { LeadStage } from '@/lib/types'

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

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
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
  return new Date(dateStr).toLocaleString('pt-BR', {
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

function isDueToday(dateStr: string | null, today: string): boolean {
  return dateStr === today
}

function getGreeting(utcHour: number): string {
  const brtHour = (utcHour - 3 + 24) % 24
  if (brtHour < 12) return 'Bom dia'
  if (brtHour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const greeting = getGreeting(d.getUTCHours())

  // Usuário logado + perfil para saudação personalizada
  const { data: { user } } = await supabase.auth.getUser()
  const profileRes = user
    ? await supabase.from('profiles').select('name').eq('id', user.id).single()
    : null
  const userName = profileRes?.data?.name ?? null
  const firstName = userName ? userName.split(' ')[0] : null

  const [
    clientsRes,
    leadsRes,
    proposalsRes,
    allPendingTasksRes,
    myTasksRes,
    interactionsRes,
    pipelineEventsRes,
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
    // Todas as tarefas da equipe (só contagem para o card)
    supabase
      .from('tasks')
      .select('id')
      .neq('status', 'done'),
    // Minhas tarefas (atribuídas ao usuário logado, não concluídas)
    user
      ? supabase
          .from('tasks')
          .select('id, title, priority, status, due_date, clients(name)')
          .eq('assigned_to_id', user.id)
          .neq('status', 'done')
          .order('due_date', { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] }),
    supabase
      .from('interactions')
      .select('id, type, description, happened_at, clients(name)')
      .order('happened_at', { ascending: false })
      .limit(5),
    supabase
      .from('pipeline_events')
      .select('id, lead_name, from_stage, to_stage, happened_at')
      .order('happened_at', { ascending: false })
      .limit(5),
  ])

  const clients = clientsRes.data ?? []
  const mrr = clients.reduce((sum: number, c: any) => sum + (c.monthly_value ?? 0), 0)
  const leadsCount = leadsRes.data?.length ?? 0
  const openProposals = proposalsRes.data ?? []
  const openProposalsValue = openProposals.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0)
  const allPendingCount = allPendingTasksRes.data?.length ?? 0
  const myTasks = (myTasksRes as any).data ?? []
  const myOverdueCount = myTasks.filter((t: any) => isOverdue(t.due_date)).length
  const myDueTodayCount = myTasks.filter((t: any) => isDueToday(t.due_date, today)).length

  // Merge interactions + pipeline events, sorted by date
  const interactions = (interactionsRes.data ?? []).map((i: any) => ({
    id: i.id,
    icon: TYPE_ICON[i.type] ?? '📝',
    description: i.description,
    sub: i.clients?.name ?? null,
    date: i.happened_at,
  }))
  const pipelineEvents = (pipelineEventsRes.data ?? []).map((e: any) => ({
    id: e.id,
    icon: '🔄',
    description: `${e.lead_name} avançou para ${STAGE_LABELS[e.to_stage as LeadStage] ?? e.to_stage}`,
    sub: `Pipeline: ${STAGE_LABELS[e.from_stage as LeadStage] ?? e.from_stage} → ${STAGE_LABELS[e.to_stage as LeadStage] ?? e.to_stage}`,
    date: e.happened_at,
  }))
  const recentActivity = [...interactions, ...pipelineEvents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return (
    <div>
      {/* Cabeçalho personalizado */}
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">
          {firstName ? `${greeting}, ${firstName}! 👋` : 'Dashboard'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {myOverdueCount > 0
            ? `Você tem ${myOverdueCount} tarefa${myOverdueCount > 1 ? 's' : ''} em atraso`
            : myDueTodayCount > 0
            ? `${myDueTodayCount} tarefa${myDueTodayCount > 1 ? 's' : ''} para hoje`
            : myTasks.length > 0
            ? `${myTasks.length} tarefa${myTasks.length > 1 ? 's' : ''} na sua fila`
            : 'Visão geral do seu negócio'}
        </p>
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
          label="Tarefas da equipe"
          value={String(allPendingCount)}
          sub={
            myTasks.length > 0
              ? `${myTasks.length} atribuída${myTasks.length > 1 ? 's' : ''} a mim`
              : 'sem atribuição a mim'
          }
          color={myOverdueCount > 0 ? 'amber' : 'white'}
        />
      </div>

      <DashboardCalendar />

      <div className="grid grid-cols-2 gap-6">
        {/* Minhas tarefas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Minhas tarefas
            </h2>
            <Link
              href="/tasks"
              className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
            >
              Ver todas →
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-6 text-center">
              <p className="text-slate-400 text-sm">Nenhuma tarefa atribuída a você 🎉</p>
              <Link
                href="/tasks"
                className="inline-block mt-2 text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
              >
                Ver tarefas da equipe →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map((task: any) => {
                const overdue = isOverdue(task.due_date)
                const dueToday = isDueToday(task.due_date, today)
                return (
                  <div
                    key={task.id}
                    className={`bg-[#1a1a1d] border rounded-lg px-4 py-3 ${
                      overdue
                        ? 'border-red-800/70'
                        : dueToday
                        ? 'border-amber-800/50'
                        : 'border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.clients && (
                            <p className="text-slate-500 text-xs">{task.clients.name}</p>
                          )}
                          <span className="text-slate-700 text-xs">
                            {STATUS_LABEL[task.status] ?? task.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-medium ${PRIORITY_COLOR[task.priority] ?? ''}`}>
                          {PRIORITY_LABEL[task.priority] ?? task.priority}
                        </span>
                        {task.due_date && (
                          <span
                            className={`text-xs ${
                              overdue
                                ? 'text-red-400'
                                : dueToday
                                ? 'text-amber-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {overdue ? '⚠ ' : dueToday ? '📅 ' : ''}{formatDate(task.due_date)}
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

        {/* Atividade recente */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Atividade recente
            </h2>
            <Link
              href="/activity"
              className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
            >
              Ver todos →
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
              Nenhuma atividade registrada ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0 mt-0.5">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-sm truncate">{item.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.sub && (
                          <p className="text-slate-500 text-xs">{item.sub}</p>
                        )}
                        <p className="text-slate-600 text-xs">{formatDatetime(item.date)}</p>
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
