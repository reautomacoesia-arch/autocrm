'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/pipeline'

type EntryKind = 'income' | 'expense'

interface ChartEntry {
  kind: EntryKind
  date: string
  detail: string
  amount: number
  status?: string
}

interface Props {
  entries: ChartEntry[]
}

// ── helpers ────────────────────────────────────────────────────────────────────
const PT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return `${PT_MONTHS[parseInt(m, 10) - 1]}/${y.slice(2)}`
}

// Paleta Korvus para a pizza de categorias
const CATEGORY_COLORS = ['#d4af37', '#1d9e75', '#38bdf8', '#f59e0b', '#f472b6', '#94a3b8', '#a855f7', '#f87171']

const COLOR_INCOME = '#1d9e75'
const COLOR_EXPENSE = '#e24b4a'

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1a1a1d', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' },
  labelStyle: { color: '#94a3b8', marginBottom: 4 },
  itemStyle: { color: '#e2e8f0' },
}

interface CategorySlice {
  name: string
  value: number
  fill: string
}

interface MonthBar {
  month: string
  Receita: number
  Despesa: number
}

export default function CashFlowCharts({ entries }: Props) {
  // ── Pizza: despesas por categoria ─────────────────────────────────────────
  const categoryData = useMemo<CategorySlice[]>(() => {
    const map: Record<string, number> = {}
    entries
      .filter((e) => e.kind === 'expense')
      .forEach((e) => {
        const category = e.detail?.trim() || 'Sem categoria'
        map[category] = (map[category] ?? 0) + e.amount
      })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
  }, [entries])

  // ── Barras: receita x despesa por mês ───────────────────────────────────────
  const monthlyData = useMemo<MonthBar[]>(() => {
    const map: Record<string, { Receita: number; Despesa: number }> = {}
    entries.forEach((e) => {
      const month = e.date.slice(0, 7)
      if (!map[month]) map[month] = { Receita: 0, Despesa: 0 }
      if (e.kind === 'income' && e.status === 'received') {
        map[month].Receita += e.amount
      } else if (e.kind === 'expense') {
        map[month].Despesa += e.amount
      }
    })
    return Object.entries(map)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([month, data]) => ({ month: monthLabel(month), ...data }))
  }, [entries])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Pizza: despesas por categoria */}
      <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-5">
        <h3 className="text-slate-300 text-sm font-semibold mb-1">Despesas por categoria</h3>
        <p className="text-slate-500 text-xs mb-4">Distribuição das despesas no período filtrado</p>
        {categoryData.length === 0 ? (
          <EmptyChart message="Sem despesas no período." />
        ) : (
          <div className="flex items-center gap-6 flex-wrap">
            <ResponsiveContainer width={180} height={240}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: unknown, _name: unknown, item: { payload?: CategorySlice }) =>
                    [formatCurrency(Number(value)), item.payload?.name ?? '']
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 min-w-[140px] grid grid-cols-1 gap-2">
              {categoryData.map((item) => (
                <div key={item.name} className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                  <div className="min-w-0">
                    <p className="text-slate-300 text-xs font-medium truncate">{item.name}</p>
                    <p className="text-slate-500 text-xs">{formatCurrency(item.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barras: receita x despesa por mês */}
      <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-5">
        <h3 className="text-slate-300 text-sm font-semibold mb-1">Receita × Despesa por mês</h3>
        <p className="text-slate-500 text-xs mb-4">Comparativo mensal do período filtrado</p>
        {monthlyData.length === 0 ? (
          <EmptyChart message="Sem dados no período." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v)}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: unknown, name: unknown) => [formatCurrency(Number(value)), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
              <Bar dataKey="Receita" fill={COLOR_INCOME} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Despesa" fill={COLOR_EXPENSE} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[240px] flex items-center justify-center text-slate-600 text-sm">
      {message}
    </div>
  )
}
