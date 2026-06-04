# Spec: Calendário Repensado (DashboardCalendar)

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase.

O `DashboardCalendar` atual é um grid mensal que mostra tarefas (chips roxos) e transações pendentes (chips âmbar). Tem problemas: bug no contador de overflow, nenhuma interatividade, células apertadas, transações só mostram valor, sem botão "Hoje", sem legenda.

Este redesenho corrige o bug, adiciona uma **agenda abaixo do grid** que mostra todos os eventos do dia selecionado, torna os eventos clicáveis, e adiciona legenda + botão "Hoje". Sem migration, sem novas tabelas.

---

## 1. API — `app/api/calendar/route.ts`

Ajuste mínimo: incluir `client_id` nas duas queries para que os eventos possam linkar para a pasta do cliente.

**Query de tarefas** — adicionar `client_id` ao select:
```ts
supabase
  .from('tasks')
  .select('id, title, due_date, status, client_id')
  .gte('due_date', startDate)
  .lte('due_date', endDate)
  .neq('status', 'done'),
```

**Query de transações** — adicionar `client_id` ao select:
```ts
supabase
  .from('transactions')
  .select('id, amount, date, type, client_id, clients(name)')
  .gte('date', startDate)
  .lte('date', endDate)
  .eq('type', 'pending'),
```

Resto da rota (validação de year/month, range de datas, retorno) permanece igual.

---

## 2. Componente — `components/dashboard/DashboardCalendar.tsx`

### Interfaces atualizadas

```ts
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
```

### Estado novo

Além de `year`, `month`, `tasks`, `transactions`, `loading` (já existentes):
```ts
const [selectedDay, setSelectedDay] = useState<number | null>(null)
```

Ao montar e ao trocar de mês, se o mês exibido for o mês atual, `selectedDay` deve iniciar como o dia de hoje. Se não for o mês atual, `selectedDay` fica `null` (nenhum dia selecionado). Implementar dentro do `useEffect` que carrega os dados, ou num `useEffect` separado que observa `year`/`month`:

```ts
useEffect(() => {
  if (year === todayYear && month === todayMonth) {
    setSelectedDay(todayDay)
  } else {
    setSelectedDay(null)
  }
}, [year, month])
```

### Helpers de agrupamento (já existem, manter)

`tasksByDay` e `txByDay` continuam agrupando por dia. **Adicionar** um helper que retorna todos os eventos de um dia, unificados e tipados, para a agenda:

```ts
type AgendaEvent =
  | { kind: 'task'; id: string; title: string; clientId: string | null }
  | { kind: 'payment'; id: string; title: string; clientId: string | null }

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
```

### Navegação ao clicar num evento

```ts
import { useRouter } from 'next/navigation'
const router = useRouter()

function goToEvent(ev: AgendaEvent) {
  if (ev.kind === 'payment') {
    if (ev.clientId) router.push(`/clients/${ev.clientId}?tab=financial`)
    else router.push('/financial')
  } else {
    if (ev.clientId) router.push(`/clients/${ev.clientId}?tab=tasks`)
    else router.push('/tasks')
  }
}
```

### Botão "Hoje"

```ts
function goToToday() {
  setYear(todayYear)
  setMonth(todayMonth)
  setSelectedDay(todayDay)
}
```

---

## 3. Layout do JSX

### Topo (header)
Reorganizar para 3 elementos:
- Esquerda: botão "Hoje" (texto, discreto)
- Centro: navegação ‹ Mês Ano ›
- Direita: legenda inline

```tsx
<div className="flex items-center justify-between mb-4">
  <button
    onClick={goToToday}
    className="text-slate-400 hover:text-white text-xs border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-1.5 transition-colors"
  >
    Hoje
  </button>

  <div className="flex items-center gap-2">
    <button onClick={prevMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" aria-label="Mês anterior">
      <ChevronLeft size={16} />
    </button>
    <h2 className="text-white text-sm font-semibold min-w-[140px] text-center">
      {MONTH_NAMES[month - 1]} {year}
    </h2>
    <button onClick={nextMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" aria-label="Próximo mês">
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
```

### Grid de dias

Cada célula de dia:
- Continua mostrando número + até 2 chips + "+N" corrigido
- Transação chip mostra `Pgto — {nome}` (sem valor)
- **Selecionável**: `onClick={() => setSelectedDay(day)}` com `cursor-pointer`
- Hoje: anel indigo (`ring-2 ring-inset ring-indigo-500`)
- Dia selecionado (e não é hoje): fundo destacado (`bg-indigo-600/15`)
- Dia selecionado E hoje: anel + fundo

```tsx
const isToday = year === todayYear && month === todayMonth && day === todayDay
const isSelected = selectedDay === day

return (
  <div
    key={day}
    onClick={() => setSelectedDay(day)}
    className={`min-h-[72px] p-1.5 cursor-pointer transition-colors ${
      isSelected ? 'bg-indigo-600/15' : 'bg-[#1e293b] hover:bg-slate-800'
    } ${isToday ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
  >
    <p className={`text-xs font-medium mb-1 text-center ${isToday ? 'text-indigo-400' : 'text-slate-400'}`}>
      {day}
    </p>
    <div className="space-y-0.5">
      {visibleTasks.map((t) => (
        <div key={t.id} title={t.title} className="bg-indigo-600/40 text-indigo-300 text-[10px] leading-tight px-1 py-0.5 rounded truncate">
          {t.title}
        </div>
      ))}
      {visibleTxs.map((tx) => (
        <div key={tx.id} title={`Pagamento — ${tx.clients?.name ?? 'cliente'}`} className="bg-amber-600/40 text-amber-300 text-[10px] leading-tight px-1 py-0.5 rounded truncate">
          Pgto — {tx.clients?.name ?? 'cliente'}
        </div>
      ))}
      {overflowCount > 0 && (
        <div className="text-slate-500 text-[10px] leading-tight px-1">+{overflowCount}</div>
      )}
    </div>
  </div>
)
```

**Correção do overflow** (o bug atual):
```ts
const visibleTasks = dayTasks.slice(0, 2)
const visibleTxs = dayTxs.slice(0, 2)
const overflowCount = Math.max(0, dayTasks.length - 2) + Math.max(0, dayTxs.length - 2)
```

### Agenda abaixo do grid

Depois do grid, sempre renderizar a seção de agenda. Quando `selectedDay` for `null`, mostrar uma dica curta. Quando houver dia selecionado, mostrar o cabeçalho + lista:

```tsx
{selectedDay !== null && (
  <div className="mt-4 pt-4 border-t border-slate-700">
    {(() => {
      const events = eventsForDay(selectedDay)
      return (
        <>
          <p className="text-white text-sm font-semibold mb-3">
            {selectedDay} de {MONTH_NAMES[month - 1]}
            <span className="text-slate-500 font-normal"> · {events.length} {events.length === 1 ? 'evento' : 'eventos'}</span>
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
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full ${ev.kind === 'task' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
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
```

---

## 4. Regras técnicas

- Sem migration, sem novas tabelas — só ajuste de select na API + redesenho do componente
- `selectedDay` reseta corretamente ao navegar entre meses (hoje se mês atual, `null` caso contrário)
- Bug de overflow corrigido com `Math.max(0, ...)` em cada termo
- Transações nunca exibem o valor em R$ — só "Pagamento — [cliente]" / "Pgto — [cliente]"
- Eventos clicáveis navegam: tarefa → `/clients/[id]?tab=tasks` (ou `/tasks`); pagamento → `/clients/[id]?tab=financial` (ou `/financial`)
- `useRouter` de `next/navigation` (Client Component)
- Loading state existente mantido

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `app/api/calendar/route.ts` | Modificar — adicionar `client_id` aos selects |
| `components/dashboard/DashboardCalendar.tsx` | Modificar — redesenho completo: estado selectedDay, botão Hoje, legenda, dia selecionável, agenda abaixo, fix overflow, transações sem valor |
