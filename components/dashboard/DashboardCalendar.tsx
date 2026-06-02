'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/pipeline'

interface CalendarTask {
  id: string
  title: string
  due_date: string
  status: string
}

interface CalendarTransaction {
  id: string
  amount: number
  date: string
  type: string
  clients: { name: string } | null
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function DashboardCalendar() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-indexed
  const [tasks, setTasks] = useState<CalendarTask[]>([])
  const [transactions, setTransactions] = useState<CalendarTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth() + 1
  const todayDay = now.getDate()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        setTasks(data.tasks ?? [])
        setTransactions(data.transactions ?? [])
        setLoading(false)
      })
  }, [year, month])

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sun

  // Group tasks and transactions by day
  const tasksByDay: Record<number, CalendarTask[]> = {}
  const txByDay: Record<number, CalendarTransaction[]> = {}

  for (const task of tasks) {
    const day = parseInt(task.due_date.split('-')[2])
    tasksByDay[day] = tasksByDay[day] ?? []
    tasksByDay[day].push(task)
  }

  for (const tx of transactions) {
    const day = parseInt(tx.date.split('-')[2])
    txByDay[day] = txByDay[day] ?? []
    txByDay[day].push(tx)
  }

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-white text-sm font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs text-slate-500 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="text-center py-8 text-slate-500 text-sm">Carregando...</div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-slate-700 border border-slate-700 rounded-lg overflow-hidden">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="bg-[#1e293b] min-h-[72px]" />
            }

            const isToday = year === todayYear && month === todayMonth && day === todayDay
            const dayTasks = tasksByDay[day] ?? []
            const dayTxs = txByDay[day] ?? []

            const visibleTasks = dayTasks.slice(0, 2)
            const visibleTxs = dayTxs.slice(0, 2)
            const overflow = (dayTasks.length - 2) + (dayTxs.length - 2)
            const overflowCount = overflow > 0 ? overflow : 0

            return (
              <div
                key={day}
                className={`bg-[#1e293b] min-h-[72px] p-1.5 ${
                  isToday ? 'ring-2 ring-inset ring-indigo-500' : ''
                }`}
              >
                <p
                  className={`text-xs font-medium mb-1 text-center ${
                    isToday ? 'text-indigo-400' : 'text-slate-400'
                  }`}
                >
                  {day}
                </p>
                <div className="space-y-0.5">
                  {visibleTasks.map((t) => (
                    <div
                      key={t.id}
                      title={t.title}
                      className="bg-indigo-600/40 text-indigo-300 text-[10px] leading-tight px-1 py-0.5 rounded truncate"
                    >
                      {t.title}
                    </div>
                  ))}
                  {visibleTxs.map((tx) => (
                    <div
                      key={tx.id}
                      title={`${tx.clients?.name ?? ''} — ${formatCurrency(tx.amount)}`}
                      className="bg-amber-600/40 text-amber-300 text-[10px] leading-tight px-1 py-0.5 rounded truncate"
                    >
                      {formatCurrency(tx.amount)}
                    </div>
                  ))}
                  {overflowCount > 0 && (
                    <div className="text-slate-500 text-[10px] leading-tight px-1">
                      +{overflowCount}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
