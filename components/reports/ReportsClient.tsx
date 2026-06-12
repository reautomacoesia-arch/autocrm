'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { SOURCE_LABELS } from '@/lib/types'

// ── types ──────────────────────────────────────────────────────────────────────
interface Transaction { amount: number; type: 'received' | 'pending'; date: string }
interface Lead { id: string; stage: string; estimated_value: number; source: string | null; created_at: string }
interface Proposal { status: string; value: number; created_at: string }
interface PipelineEvent { lead_id: string; from_stage: string; to_stage: string; happened_at: string }

interface Props {
  transactions: Transaction[]
  leads: Lead[]
  proposals: Proposal[]
  pipelineEvents: PipelineEvent[]
  mrr: number
  activeClients: number
  churnedClients: number
  churnedMrr: number
  churnRate: number
}

type Range = '3m' | '6m' | '12m' | 'all'

// ── helpers ────────────────────────────────────────────────────────────────────
const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v)
}

function fmtShort(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`
  return fmtCurrency(v)
}

function monthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${PT_MONTHS[parseInt(m) - 1]}/${y.slice(2)}`
}

function monthsAgo(n: number): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  d.setMonth(d.getMonth() - n + 1)
  return d
}

function generateMonthList(n: number): string[] {
  const list: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return list
}

const STAGE_ORDER = ['lead', 'contacted', 'proposal_sent', 'negotiating', 'won', 'lost']
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  contacted: 'Contato feito',
  proposal_sent: 'Proposta enviada',
  negotiating: 'Negociando',
  won: 'Fechado ✓',
  lost: 'Perdido ✗',
}
const STAGE_COLORS: Record<string, string> = {
  lead: '#64748b',
  contacted: '#3b82f6',
  proposal_sent: '#f59e0b',
  negotiating: '#a855f7',
  won: '#22c55e',
  lost: '#ef4444',
}
// Probabilidade de fechamento por estágio, usada no forecast ponderado
const STAGE_PROBABILITY: Record<string, number> = {
  lead: 0.1,
  contacted: 0.25,
  proposal_sent: 0.5,
  negotiating: 0.75,
}
const OPEN_STAGES = Object.keys(STAGE_PROBABILITY)

function fmtDays(v: number) {
  if (v < 1) return `${Math.round(v * 24)}h`
  return `${v.toFixed(1)}d`
}

const PROPOSAL_COLORS: Record<string, string> = {
  draft: '#64748b',
  sent: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
}
const PROPOSAL_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
}

// ── tooltip styles ─────────────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: { backgroundColor: '#1a1a1d', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' },
  labelStyle: { color: '#94a3b8', marginBottom: 4 },
  itemStyle: { color: '#e2e8f0' },
}

// ── main component ─────────────────────────────────────────────────────────────
export default function ReportsClient({
  transactions, leads, proposals, pipelineEvents, mrr, activeClients, churnedClients, churnedMrr, churnRate,
}: Props) {
  const [range, setRange] = useState<Range>('6m')

  const monthCount = range === 'all' ? 24 : range === '12m' ? 12 : range === '6m' ? 6 : 3

  // ── Revenue by month ────────────────────────────────────────────────────────
  const revenueData = useMemo(() => {
    const months = generateMonthList(monthCount)
    const map: Record<string, { received: number; pending: number }> = {}
    months.forEach((m) => { map[m] = { received: 0, pending: 0 } })

    const cutoff = range === 'all' ? null : monthsAgo(monthCount)
    transactions.forEach((t) => {
      const month = t.date.substring(0, 7)
      if (cutoff && new Date(t.date) < cutoff) return
      if (map[month]) map[month][t.type] += t.amount
    })

    return months.map((m) => ({
      month: monthLabel(m),
      Recebido: map[m].received,
      Pendente: map[m].pending,
    }))
  }, [transactions, range, monthCount])

  // ── Period totals ───────────────────────────────────────────────────────────
  const { totalReceived, totalPending } = useMemo(() => {
    const cutoff = range === 'all' ? null : monthsAgo(monthCount)
    const filtered = cutoff
      ? transactions.filter((t) => new Date(t.date) >= cutoff)
      : transactions
    return {
      totalReceived: filtered.filter((t) => t.type === 'received').reduce((s, t) => s + t.amount, 0),
      totalPending: filtered.filter((t) => t.type === 'pending').reduce((s, t) => s + t.amount, 0),
    }
  }, [transactions, range, monthCount])

  // ── Win rate ────────────────────────────────────────────────────────────────
  const { winRate, wonCount, lostCount } = useMemo(() => {
    const won = leads.filter((l) => l.stage === 'won').length
    const lost = leads.filter((l) => l.stage === 'lost').length
    return {
      winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
      wonCount: won,
      lostCount: lost,
    }
  }, [leads])

  // ── Proposals approved ──────────────────────────────────────────────────────
  const { approvedCount, approvedValue } = useMemo(() => {
    const approved = proposals.filter((p) => p.status === 'approved')
    return {
      approvedCount: approved.length,
      approvedValue: approved.reduce((s, p) => s + p.value, 0),
    }
  }, [proposals])

  // ── Leads funnel ────────────────────────────────────────────────────────────
  const funnelData = useMemo(() =>
    STAGE_ORDER
      .filter((s) => s !== 'lost') // show lost separately
      .map((stage) => {
        const group = leads.filter((l) => l.stage === stage)
        return {
          stage: STAGE_LABELS[stage],
          count: group.length,
          value: group.reduce((s, l) => s + (l.estimated_value ?? 0), 0),
          fill: STAGE_COLORS[stage],
        }
      })
      .filter((d) => d.count > 0)
  , [leads])

  // ── Forecast (valor × probabilidade do estágio) ─────────────────────────────
  const forecastValue = useMemo(() =>
    leads
      .filter((l) => OPEN_STAGES.includes(l.stage))
      .reduce((sum, l) => sum + (l.estimated_value ?? 0) * STAGE_PROBABILITY[l.stage], 0)
  , [leads])

  const openPipelineValue = useMemo(() =>
    leads
      .filter((l) => OPEN_STAGES.includes(l.stage))
      .reduce((sum, l) => sum + (l.estimated_value ?? 0), 0)
  , [leads])

  // ── Tempo médio por etapa ────────────────────────────────────────────────────
  const stageTimeData = useMemo(() => {
    const byLead: Record<string, PipelineEvent[]> = {}
    pipelineEvents.forEach((e) => {
      (byLead[e.lead_id] ??= []).push(e)
    })
    Object.values(byLead).forEach((arr) =>
      arr.sort((a, b) => new Date(a.happened_at).getTime() - new Date(b.happened_at).getTime())
    )

    const durations: Record<string, number[]> = {}

    leads.forEach((lead) => {
      const events = byLead[lead.id] ?? []
      let prevTime = new Date(lead.created_at).getTime()
      events.forEach((e) => {
        const eventTime = new Date(e.happened_at).getTime()
        const days = (eventTime - prevTime) / 86_400_000
        if (days >= 0) {
          (durations[e.from_stage] ??= []).push(days)
        }
        prevTime = eventTime
      })
    })

    return STAGE_ORDER
      .filter((s) => durations[s]?.length)
      .map((stage) => ({
        stage: STAGE_LABELS[stage],
        avgDays: durations[stage].reduce((a, b) => a + b, 0) / durations[stage].length,
        count: durations[stage].length,
        fill: STAGE_COLORS[stage],
      }))
  }, [leads, pipelineEvents])

  // ── Proposals by status ─────────────────────────────────────────────────────
  const proposalData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {}
    proposals.forEach((p) => {
      if (!map[p.status]) map[p.status] = { count: 0, value: 0 }
      map[p.status].count++
      map[p.status].value += p.value
    })
    return Object.entries(map).map(([status, data]) => ({
      name: PROPOSAL_LABELS[status] ?? status,
      value: data.count,
      totalValue: data.value,
      fill: PROPOSAL_COLORS[status] ?? '#64748b',
    }))
  }, [proposals])

  // ── Leads by source ─────────────────────────────────────────────────────────
  const sourceData = useMemo(() => {
    const map: Record<string, number> = {}
    leads.forEach((l) => {
      const src = l.source || 'outro'
      map[src] = (map[src] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([src, count]) => ({ source: SOURCE_LABELS[src] ?? src, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7)
  }, [leads])

  const rangeLabel = range === 'all' ? 'todo o período' : `últimos ${range.replace('m', ' meses')}`

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Relatórios</h1>
          <p className="text-slate-400 text-sm mt-1">Evolução e tendências do negócio</p>
        </div>
        {/* Range selector */}
        <div className="flex gap-1 bg-[#1a1a1d] border border-slate-700 rounded-lg p-1">
          {(['3m', '6m', '12m', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {r === 'all' ? 'Tudo' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KPICard
          label="MRR atual"
          value={fmtCurrency(mrr)}
          sub={`${activeClients} cliente${activeClients !== 1 ? 's' : ''} ativo${activeClients !== 1 ? 's' : ''}`}
          color="emerald"
        />
        <KPICard
          label="Recebido"
          value={fmtCurrency(totalReceived)}
          sub={rangeLabel}
          color="blue"
        />
        <KPICard
          label="Taxa de ganho"
          value={`${winRate}%`}
          sub={`${wonCount} fechados · ${lostCount} perdidos`}
          color={winRate >= 50 ? 'emerald' : winRate >= 30 ? 'amber' : 'red'}
          icon={winRate >= 50 ? 'up' : winRate >= 30 ? 'flat' : 'down'}
        />
        <KPICard
          label="Propostas aprovadas"
          value={String(approvedCount)}
          sub={approvedValue > 0 ? fmtCurrency(approvedValue) + ' em contratos' : 'nenhuma ainda'}
          color="indigo"
        />
        <KPICard
          label="Previsão de receita"
          value={fmtCurrency(forecastValue)}
          sub={`pipeline em aberto: ${fmtCurrency(openPipelineValue)}`}
          color="amber"
        />
        <KPICard
          label="Taxa de churn"
          value={`${churnRate.toFixed(1)}%`}
          sub={`${churnedClients} cliente${churnedClients !== 1 ? 's' : ''} perdido${churnedClients !== 1 ? 's' : ''}${churnedMrr > 0 ? ` · -${fmtCurrency(churnedMrr)}/mês` : ''}`}
          color={churnRate <= 5 ? 'emerald' : churnRate <= 15 ? 'amber' : 'red'}
          icon={churnRate <= 5 ? 'up' : churnRate <= 15 ? 'flat' : 'down'}
        />
      </div>

      {/* ── Revenue chart ── */}
      <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-5 mb-5">
        <h2 className="text-slate-300 text-sm font-semibold mb-1">Receita mensal</h2>
        <p className="text-slate-500 text-xs mb-4">Valores recebidos e pendentes por mês</p>
        {revenueData.every((d) => d.Recebido === 0 && d.Pendente === 0) ? (
          <EmptyChart message="Nenhuma transação registrada neste período." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: unknown, name: unknown) => [fmtCurrency(Number(value)), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
              <Bar dataKey="Recebido" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Pendente" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Funnel + Source ── */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Pipeline funnel */}
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-5">
          <h2 className="text-slate-300 text-sm font-semibold mb-1">Funil do pipeline</h2>
          <p className="text-slate-500 text-xs mb-4">Leads por estágio (estado atual)</p>
          {funnelData.length === 0 ? (
            <EmptyChart message="Nenhum lead cadastrado ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: unknown, _: unknown, entry: any) => {
                    const n = Number(value)
                    return [`${n} lead${n !== 1 ? 's' : ''} · ${fmtCurrency(entry.payload.value)}`, '']
                  }}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leads by source */}
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-5">
          <h2 className="text-slate-300 text-sm font-semibold mb-1">Origem dos leads</h2>
          <p className="text-slate-500 text-xs mb-4">De onde vêm seus melhores leads</p>
          {sourceData.length === 0 ? (
            <EmptyChart message="Nenhum lead com origem cadastrada." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sourceData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="source"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: unknown) => { const n = Number(value); return [`${n} lead${n !== 1 ? 's' : ''}`, 'Quantidade'] }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Tempo médio por etapa + Proposals donut ── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Tempo médio por etapa */}
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-5">
          <h2 className="text-slate-300 text-sm font-semibold mb-1">Tempo médio por etapa</h2>
          <p className="text-slate-500 text-xs mb-4">Quanto tempo os leads ficam em cada estágio antes de avançar</p>
          {stageTimeData.length === 0 ? (
            <EmptyChart message="Ainda não há transições de estágio registradas." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageTimeData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtDays} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: unknown, _: unknown, entry: { payload?: { count: number } }) => {
                    const n = entry.payload?.count ?? 0
                    return [`${fmtDays(Number(value))} (média de ${n} lead${n !== 1 ? 's' : ''})`, '']
                  }}
                />
                <Bar dataKey="avgDays" radius={[0, 3, 3, 0]}>
                  {stageTimeData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Proposals donut */}
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-5">
          <h2 className="text-slate-300 text-sm font-semibold mb-1">Propostas por status</h2>
          <p className="text-slate-500 text-xs mb-4">Distribuição atual de todas as propostas</p>
          {proposalData.length === 0 ? (
            <EmptyChart message="Nenhuma proposta criada ainda." />
          ) : (
            <div className="flex items-center gap-8">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={proposalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {proposalData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(count: unknown, _: unknown, entry: any) => {
                      const n = Number(count)
                      return [`${n} proposta${n !== 1 ? 's' : ''} · ${fmtCurrency(entry.payload.totalValue)}`, entry.payload.name]
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend + stats */}
              <div className="flex-1 grid grid-cols-2 gap-3">
                {proposalData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                    <div>
                      <p className="text-slate-300 text-sm font-medium">{item.name}</p>
                      <p className="text-slate-500 text-xs">
                        {item.value} · {fmtCurrency(item.totalValue)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── sub-components ─────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, color, icon,
}: {
  label: string
  value: string
  sub?: string
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'indigo'
  icon?: 'up' | 'down' | 'flat'
}) {
  const colorMap = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    indigo: 'text-indigo-400',
  }
  return (
    <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl px-5 py-4">
      <p className="text-slate-500 text-xs mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
        {icon === 'up' && <TrendingUp size={16} className="text-emerald-500" />}
        {icon === 'down' && <TrendingDown size={16} className="text-red-500" />}
        {icon === 'flat' && <Minus size={16} className="text-amber-500" />}
      </div>
      {sub && <p className="text-slate-600 text-xs mt-1.5">{sub}</p>}
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">
      {message}
    </div>
  )
}
