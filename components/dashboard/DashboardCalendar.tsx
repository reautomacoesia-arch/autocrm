'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarTask {
  id: string
  title: string
  due_date: string
  status: string
  client_id: string | null
}

interface CalendarTransaction {
  id: string
  amount: number
  date: string
  type: string
  client_id: string | null
  clients: { name: string } | null
}

type AgendaEvent =
  | { kind: 'task'; id: string; title: string; clientId: string | null }
  | { kind: 'payment'; id: string; title: string; clientId: string | null }

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
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const router = useRouter()

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

  // Seleciona hoje ao abrir o mês atual; limpa seleção em outros meses
  useEffect(() => {
    if (year === todayYear && month === todayMonth) {
      setSelectedDay(todayDay)
    } else {
      setSelectedDay(null)
    }
  }, [year, month, todayYear, todayMonth, todayDay])

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

  function goToToday() {
    setYear(todayYear)
    setMonth(todayMonth)
    setSelectedDay(todayDay)
  }

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sun

  // Group by day
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

  function eventsForDay(day: number): AgendaEvent[] {
    const taskEvents: AgendaEvent[] = (tasksByDay[day] ?? []).map((t) => ({
      kind: 'task',
      id: t.id,
      title: t.title,
      clientId: t.client_id,
    }))
    const paymentEvents: AgendaEvent[] = (txByDay[day] ?? []).map((tx) => ({
      kind: 'payment',
      id: tx.id,
      title: `Pagamento — ${tx.clients?.name ?? 'cliente'}`,
      clientId: tx.client_id,
    }))
    return [...taskEvents, ...paymentEvents]
  }

  function goToEvent(ev: AgendaEvent) {
    if (ev.kind === 'payment') {
      if (ev.clientId) router.push(`/clients/${ev.clientId}?tab=financial`)
      else router.push('/financial')
    } else {
      if (ev.clientId) router.push(`/clients/${ev.clientId}?tab=tasks`)
      else router.push('/tasks')
    }
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
          onClick={goToToday}
          className="text-slate-400 hover:text-white text-xs border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-1.5 transition-colors"
        >
          Hoje
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-white text-sm font-semibold min-w-[140px] text-center">
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

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> Tarefa
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Pagamento
          </span>
        </div>
      </div>

      {/* Day name headers */}
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
            const isSelected = selectedDay === day
            const dayTasks = tasksByDay[day] ?? []
            const dayTxs = txByDay[day] ?? []

            const visibleTasks = dayTasks.slice(0, 2)
            const visibleTxs = dayTxs.slice(0, 2)
            const overflowCount = Math.max(0, dayTasks.length - 2) + Math.max(0, dayTxs.length - 2)

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[72px] p-1.5 cursor-pointer transition-colors ${
                  isSelected ? 'bg-indigo-600/15' : 'bg-[#1e293b] hover:bg-slate-800'
                } ${isToday ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
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
                      title={`Pagamento — ${tx.clients?.name ?? 'cliente'}`}
                      className="bg-amber-600/40 text-amber-300 text-[10px] leading-tight px-1 py-0.5 rounded truncate"
                    >
                      Pgto — {tx.clients?.name ?? 'cliente'}
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

      {/* Agenda do dia selecionado */}
      {selectedDay !== null && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          {(() => {
            const events = eventsForDay(selectedDay)
            return (
              <>
                <p className="text-white text-sm font-semibold mb-3">
                  {selectedDay} de {MONTH_NAMES[month - 1]}
                  <span className="text-slate-500 font-normal">
                    {' '}· {events.length} {events.length === 1 ? 'evento' : 'eventos'}
                  </span>
                </p>
                {events.length === 0 ? (
                  <p className="text-slate-500 text-sm py-2">Nenhum evento neste dia.</p>
                ) : (
                  <div className="space-y-1.5">
                    {events.map((ev) => (
                      <button
                        key={`${ev.kind}-${ev.id}`}
                        onClick={() => goToEvent(ev)}
                        className="w-full flex items-center gap-2.5 bg-[#0f172a] hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-left transition-colors group"
                      >
                        <span
                          className={`flex-shrink-0 w-2 h-2 rounded-full ${
                            ev.kind === 'task' ? 'bg-indigo-500' : 'bg-amber-500'
                          }`}
                        />
                        <span className="flex-1 text-slate-200 text-sm truncate">{ev.title}</span>
                        <span className="flex-shrink-0 text-slate-600 text-xs group-hover:text-slate-400 transition-colors">
                          {ev.kind === 'task' ? 'tarefa' : 'financeiro'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
