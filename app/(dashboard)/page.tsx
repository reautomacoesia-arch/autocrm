import { createClient } from '@/lib/supabase/server'
import { formatCurrency, DEFAULT_STAGES } from '@/lib/pipeline'
import MetricCard from '@/components/dashboard/MetricCard'
import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'
import DashboardCalendar from '@/components/dashboard/DashboardCalendar'
import FocusToday from '@/components/dashboard/FocusToday'
import PipelineFunnel from '@/components/dashboard/PipelineFunnel'
import QuickActions from '@/components/dashboard/QuickActions'
import type { PipelineStage } from '@/lib/types'
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

/**
 * Agrupa registros em `weeks` baldes semanais terminando hoje.
 * Cada balde soma `valueFn(row)` (ou conta 1 se ausente) para os
 * registros cuja data em `dateField` cai naquela semana.
 */
function bucketByWeek<T extends Record<string, unknown>>(
  rows: T[],
  dateField: keyof T,
  weeks = 8,
  valueFn?: (row: T) => number
): number[] {
  const buckets = new Array(weeks).fill(0)
  const now = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000

  for (const row of rows) {
    const raw = row[dateField]
    if (!raw) continue
    const date = new Date(raw as string)
    if (isNaN(date.getTime())) continue

    const diffWeeks = Math.floor((now.getTime() - date.getTime()) / msPerWeek)
    const bucketIndex = weeks - 1 - diffWeeks

    if (bucketIndex < 0 || bucketIndex >= weeks) continue

    buckets[bucketIndex] += valueFn ? valueFn(row) : 1
  }

  return buckets
}

/**
 * Delta percentual semana atual vs. semana anterior: se `lastWeek > 0`,
 * retorna a variação percentual; senão, 100 se `thisWeek > 0`, ou 0.
 */
function weekOverWeekDelta(thisWeek: number, lastWeek: number): number {
  if (lastWeek > 0) return ((thisWeek - lastWeek) / lastWeek) * 100
  return thisWeek > 0 ? 100 : 0
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
    stagesRes,
  ] = await Promise.all([
    supabase.from('clients').select('id, monthly_value, created_at').eq('status', 'active').eq('is_internal', false),
    supabase
      .from('leads')
      .select('id, stage, estimated_value, created_at'),
    supabase
      .from('proposals')
      .select('id, value, created_at')
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
    supabase
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true }),
  ])

  const stages = (stagesRes.data as PipelineStage[] | null)?.length
    ? (stagesRes.data as PipelineStage[])
    : DEFAULT_STAGES

  const stagesBySlug: Record<string, PipelineStage> = {}
  stages.forEach((s) => { stagesBySlug[s.slug] = s })

  const STAGE_LABELS: Record<string, string> = {}
  stages.forEach((s) => { STAGE_LABELS[s.slug] = s.label })

  const OPEN_STAGE_SLUGS = stages.filter((s) => s.type === 'open').map((s) => s.slug)

  const clients = clientsRes.data ?? []
  const mrr = clients.reduce((sum: number, c: any) => sum + (c.monthly_value ?? 0), 0)
  const allLeads: { id: string; stage: string; estimated_value: number | null; created_at: string }[] = leadsRes.data ?? []
  const openLeadsList = allLeads.filter((l) => stagesBySlug[l.stage]?.type === 'open')
  const leadsCount = openLeadsList.length
  const openProposals = proposalsRes.data ?? []
  const openProposalsValue = openProposals.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0)

  // ── Tendências/sparklines (dados reais derivados de created_at) ────────
  const WEEKS = 8

  // MRR: sparkline = soma cumulativa de monthly_value por semana de entrada
  const mrrByWeek = bucketByWeek(clients, 'created_at', WEEKS, (c) => c.monthly_value ?? 0)
  const mrrCumulative: number[] = []
  mrrByWeek.reduce((acc, v, i) => {
    mrrCumulative[i] = acc + v
    return mrrCumulative[i]
  }, 0)
  // delta consistente com a própria série da sparkline (cumulativa da janela),
  // não com o MRR total — senão o percentual fica sem sentido p/ clientes antigos
  const mrrLatest = mrrCumulative[WEEKS - 1] ?? 0
  const mrr4WeeksAgo = mrrCumulative[WEEKS - 5] ?? 0
  const mrrTrendDelta =
    mrr4WeeksAgo > 0 ? ((mrrLatest - mrr4WeeksAgo) / mrr4WeeksAgo) * 100 : 0

  // Leads ativos: sparkline = contagem por semana, delta semana atual vs anterior
  const leadsByWeek = bucketByWeek(openLeadsList, 'created_at', WEEKS)
  const leadsThisWeek = leadsByWeek[WEEKS - 1] ?? 0
  const leadsLastWeek = leadsByWeek[WEEKS - 2] ?? 0
  const leadsTrendDelta = weekOverWeekDelta(leadsThisWeek, leadsLastWeek)

  // Propostas abertas: sparkline = valor por semana, delta semana atual vs anterior
  const proposalsByWeek = bucketByWeek(openProposals, 'created_at', WEEKS, (p) => p.value ?? 0)
  const proposalsThisWeek = proposalsByWeek[WEEKS - 1] ?? 0
  const proposalsLastWeek = proposalsByWeek[WEEKS - 2] ?? 0
  const proposalsTrendDelta = weekOverWeekDelta(proposalsThisWeek, proposalsLastWeek)
  const allPendingCount = allPendingTasksRes.data?.length ?? 0
  const myTasks = (myTasksRes as any).data ?? []
  const overdueTasks = myTasks.filter((t: any) => isOverdue(t.due_date))
  const dueTodayTasks = myTasks.filter((t: any) => isDueToday(t.due_date, today))
  const myOverdueCount = overdueTasks.length
  const myDueTodayCount = dueTodayTasks.length

  // ── Funil do pipeline: agrupa leads abertos por estágio ─────────────────
  const pipelineFunnelStages = OPEN_STAGE_SLUGS.map((stage) => {
    const leadsInStage = openLeadsList.filter((l) => l.stage === stage)
    return {
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      count: leadsInStage.length,
      value: leadsInStage.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0),
    }
  })

  // Merge interactions + pipeline events, sorted by date
  const interactions = (interactionsRes.data ?? []).map((i: any) => ({
    id: i.id,
    icon: TYPE_ICON[i.type] ?? '📝',
    description: i.description,
    sub: i.clients?.name ?? null,
    date: i.happened_at,
  }))
  const pipelineEvents = (pipelineEventsRes.data ?? []).map((e: any) => {
    const isNew = e.from_stage === 'new'
    return {
      id: e.id,
      icon: isNew ? '✨' : '🔄',
      description: isNew
        ? `Novo lead: ${e.lead_name}`
        : `${e.lead_name} avançou para ${STAGE_LABELS[e.to_stage] ?? e.to_stage}`,
      sub: isNew
        ? `Adicionado ao pipeline (${STAGE_LABELS[e.to_stage] ?? e.to_stage})`
        : `Pipeline: ${STAGE_LABELS[e.from_stage] ?? e.from_stage} → ${STAGE_LABELS[e.to_stage] ?? e.to_stage}`,
      date: e.happened_at,
    }
  })
  const recentActivity = [...interactions, ...pipelineEvents]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return (
    <div>
      {/* Cabeçalho personalizado */}
      <PageHeader
        title={firstName ? `${greeting}, ${firstName}! 👋` : 'Dashboard'}
        subtitle={
          myOverdueCount > 0
            ? `Você tem ${myOverdueCount} tarefa${myOverdueCount > 1 ? 's' : ''} em atraso`
            : myDueTodayCount > 0
            ? `${myDueTodayCount} tarefa${myDueTodayCount > 1 ? 's' : ''} para hoje`
            : myTasks.length > 0
            ? `${myTasks.length} tarefa${myTasks.length > 1 ? 's' : ''} na sua fila`
            : 'Visão geral do seu negócio'
        }
        action={<QuickActions />}
      />

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="MRR"
          value={formatCurrency(mrr)}
          sub={`${clients.length} cliente(s) ativo(s)`}
          color="green"
          trend={{ delta: mrrTrendDelta }}
          spark={mrrCumulative}
        />
        <MetricCard
          label="Leads ativos"
          value={String(leadsCount)}
          sub="no pipeline"
          color="indigo"
          trend={{ delta: leadsTrendDelta }}
          spark={leadsByWeek}
        />
        <MetricCard
          label="Propostas abertas"
          value={String(openProposals.length)}
          sub={openProposalsValue > 0 ? `${formatCurrency(openProposalsValue)} em jogo` : undefined}
          color="amber"
          trend={{ delta: proposalsTrendDelta }}
          spark={proposalsByWeek}
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

      {/* Foco do dia + Funil do pipeline */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <FocusToday overdueTasks={overdueTasks} dueTodayTasks={dueTodayTasks} />
        <PipelineFunnel stages={pipelineFunnelStages} />
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
