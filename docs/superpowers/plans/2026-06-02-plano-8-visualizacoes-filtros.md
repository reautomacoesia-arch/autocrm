# Pacote 2 — Visualizações e Filtros: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar filtros, agrupamentos e cards de resumo em 5 módulos do AutoCRM: Tarefas, Financeiro Global, Histórico de Interações, Lista de Clientes e Propostas.

**Architecture:** Client-side filtering puro — estado local (useState) em cada componente. Os dados já estão carregados no cliente; filtrar é computar arrays derivados. Nenhuma chamada de API adicional. Nenhuma migration de banco.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, React (useState), Lucide React

> **Nota:** Sem suite de testes neste projeto. Padrão das tarefas: Implementar → Verificar no browser → Commit.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `components/tasks/TaskList.tsx` | Modificar — T1 agrupamento |
| `components/financial/TransactionManager.tsx` | Modificar — FN1+FN4 filtros + breakdown |
| `components/clients/folder/HistoryTab.tsx` | Modificar — A1 filtro por tipo |
| `components/clients/ClientList.tsx` | Modificar — C1+C2 filtro status + ordenação |
| `components/proposals/ProposalList.tsx` | Modificar — PR1 cards de resumo |

---

### Task 1: T1 — Agrupamento de Tarefas (TaskList)

**Files:**
- Modify: `components/tasks/TaskList.tsx`

**Contexto:** TaskList já tem filtro por status (botões "Todas / Pendente / Em andamento / Concluída") e expand por tarefa. Adicionar dropdown "Agrupar por" que agrupa a lista filtrada em seções colapsáveis. Os filtros existentes continuam funcionando em paralelo.

- [ ] **Step 1: Ler o arquivo atual**

```bash
# Confirmar estrutura atual antes de editar
```
Ler `components/tasks/TaskList.tsx` do início ao fim.

- [ ] **Step 2: Adicionar ChevronRight ao import do lucide-react**

Localizar:
```tsx
import { Plus, Trash2 } from 'lucide-react'
```
Substituir por:
```tsx
import { Plus, Trash2, ChevronRight } from 'lucide-react'
```

- [ ] **Step 3: Adicionar tipos e estado de agrupamento**

Após a linha `const STATUS_VARIANT: Record<...> = { ... }`, adicionar:

```tsx
type GroupBy = 'none' | 'status' | 'priority' | 'client'

const GROUP_LABELS_PRIORITY: Record<string, string> = {
  high: 'Alta prioridade',
  medium: 'Média prioridade',
  low: 'Baixa prioridade',
}
```

Dentro do componente `TaskList`, após os hooks `useToast` e `useConfirm`, adicionar:

```tsx
const [groupBy, setGroupBy] = useState<GroupBy>('none')
const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

function toggleGroup(key: string) {
  setCollapsedGroups((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
}
```

- [ ] **Step 4: Adicionar lógica de computação dos grupos**

Após a linha `const clientMap = Object.fromEntries(...)`, adicionar:

```tsx
interface TaskGroup {
  key: string
  label: string
  tasks: Task[]
}

function computeGroups(tasks: Task[]): TaskGroup[] {
  if (groupBy === 'none') return []

  if (groupBy === 'status') {
    const order: TaskStatus[] = ['pending', 'in_progress', 'done']
    return order
      .map((s) => ({ key: s, label: STATUS_LABEL[s], tasks: tasks.filter((t) => t.status === s) }))
      .filter((g) => g.tasks.length > 0)
  }

  if (groupBy === 'priority') {
    const order: TaskPriority[] = ['high', 'medium', 'low']
    return order
      .map((p) => ({ key: p, label: GROUP_LABELS_PRIORITY[p], tasks: tasks.filter((t) => t.priority === p) }))
      .filter((g) => g.tasks.length > 0)
  }

  if (groupBy === 'client') {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const key = t.client_id ?? '__none__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return Array.from(map.entries())
      .map(([key, tasks]) => ({
        key,
        label: key === '__none__' ? 'Sem cliente' : (clientMap[key] ?? 'Cliente removido'),
        tasks,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  return []
}

const groups = computeGroups(filtered)
```

- [ ] **Step 5: Adicionar o dropdown "Agrupar por" na toolbar**

Localizar o `<div className="flex items-center justify-between mb-4">` que contém os botões de filtro e o botão "Nova Tarefa". Adicionar o select entre os dois:

```tsx
<div className="flex items-center justify-between mb-4">
  <div className="flex gap-2 flex-wrap">
    {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => (
      <button
        key={f}
        onClick={() => setFilter(f)}
        className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
          filter === f
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
        }`}
      >
        {f === 'all' ? `Todas (${tasks.length})` : STATUS_LABEL[f as TaskStatus]}
      </button>
    ))}
  </div>
  <div className="flex items-center gap-2">
    <select
      value={groupBy}
      onChange={(e) => {
        setGroupBy(e.target.value as GroupBy)
        setCollapsedGroups(new Set())
      }}
      className="bg-[#1e293b] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
    >
      <option value="none">Sem agrupamento</option>
      <option value="status">Por status</option>
      <option value="priority">Por prioridade</option>
      <option value="client">Por cliente</option>
    </select>
    <button
      onClick={() => setIsModalOpen(true)}
      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      <Plus size={14} />
      Nova Tarefa
    </button>
  </div>
</div>
```

- [ ] **Step 6: Atualizar a renderização da lista para suportar grupos**

Localizar `<div className="space-y-2">` e substituir seu conteúdo interno pelo seguinte (preservando toda a lógica de renderização individual de tarefas):

```tsx
<div className="space-y-2">
  {filtered.length === 0 ? (
    filter === 'all' ? (
      <EmptyState
        icon="✅"
        title="Nenhuma tarefa ainda"
        description="Crie tarefas para acompanhar o que precisa ser feito."
        action={{ label: '+ Nova Tarefa', onClick: () => setIsModalOpen(true) }}
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
            <ChevronRight
              size={14}
              className={`text-slate-500 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
            />
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {group.label}
            </span>
            <span className="text-slate-600 text-xs bg-slate-800 px-2 py-0.5 rounded-full">
              {group.tasks.length}
            </span>
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
```

- [ ] **Step 7: Extrair renderização de tarefa individual para função `renderTask`**

Para evitar duplicação entre o modo agrupado e o modo plano, extrair a renderização de cada tarefa para uma função antes do `return`:

```tsx
function renderTask(task: Task) {
  const isExpanded = expandedId === task.id
  return (
    <div key={task.id}>
      {/* ... todo o JSX atual de renderização de tarefa individual ... */}
    </div>
  )
}
```

Ler o arquivo para copiar exatamente o JSX atual de renderização de cada tarefa (o bloco `filtered.map((task) => { ... })` existente) e movê-lo para esta função.

- [ ] **Step 8: Verificar no browser**

Abrir `/tasks`. Testar:
- Sem agrupamento: lista normal funcionando
- Agrupar por prioridade: ver seções "Alta / Média / Baixa" com chevron
- Click no header: colapsa/expande
- Filtro de status + agrupamento simultâneos

- [ ] **Step 9: Commit**

```bash
git add components/tasks/TaskList.tsx
git commit -m "feat: add collapsible task grouping by status/priority/client (T1)"
```

---

### Task 2: FN1+FN4 — Filtros e Breakdown no Financeiro Global (TransactionManager)

**Files:**
- Modify: `components/financial/TransactionManager.tsx`

**Contexto:** TransactionManager já tem cards de resumo (MRR, totalReceived, totalPending) calculados sobre TODAS as transações. FN1 adiciona 3 dropdowns de filtro; os totais passam a refletir a lista filtrada. FN4 adiciona uma aba "Por cliente" que agrupa as transações filtradas.

- [ ] **Step 1: Ler o arquivo atual completo**

Ler `components/financial/TransactionManager.tsx` completo para entender a estrutura atual.

- [ ] **Step 2: Adicionar estado de filtros e de view**

Dentro do componente, após os estados existentes (`editSaving` etc.), adicionar:

```tsx
// FN1 — filtros
const [filterType, setFilterType] = useState<'all' | 'received' | 'pending'>('all')
const [filterClientId, setFilterClientId] = useState<string>('')
const [filterMonth, setFilterMonth] = useState<string>('')

// FN4 — view
const [activeView, setActiveView] = useState<'transactions' | 'by_client'>('transactions')
```

- [ ] **Step 3: Computar lista filtrada e totais dinâmicos**

Substituir as linhas atuais de `totalReceived` e `totalPending` (que calculam sobre `transactions`) por:

```tsx
// Lista filtrada (FN1)
const filteredTransactions = transactions
  .filter((t) => filterType === 'all' || t.type === filterType)
  .filter((t) => !filterClientId || t.client_id === filterClientId)
  .filter((t) => !filterMonth || t.date.startsWith(filterMonth))

// Totais sobre lista filtrada
const totalReceived = filteredTransactions
  .filter((t) => t.type === 'received')
  .reduce((sum, t) => sum + t.amount, 0)
const totalPending = filteredTransactions
  .filter((t) => t.type === 'pending')
  .reduce((sum, t) => sum + t.amount, 0)
const totalAll = totalReceived + totalPending
```

- [ ] **Step 4: Gerar opções de mês**

Após o estado, antes do `return`, adicionar função helper:

```tsx
function getMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    opts.push({ value, label })
  }
  return opts
}
const monthOptions = getMonthOptions()
```

- [ ] **Step 5: Adicionar tabs de view no JSX (antes da barra de filtros)**

No início do bloco JSX retornado, antes dos cards de resumo, adicionar:

```tsx
{/* View tabs — FN4 */}
<div className="flex gap-0 border-b border-slate-700 mb-4">
  <button
    onClick={() => setActiveView('transactions')}
    className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
      activeView === 'transactions'
        ? 'text-indigo-400 border-indigo-500 font-medium'
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`}
  >
    📋 Transações
  </button>
  <button
    onClick={() => setActiveView('by_client')}
    className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
      activeView === 'by_client'
        ? 'text-indigo-400 border-indigo-500 font-medium'
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`}
  >
    📊 Por cliente
  </button>
</div>
```

- [ ] **Step 6: Atualizar cards de resumo para usar totais dinâmicos**

Localizar os 3 cards de resumo (MRR, Total Recebido, Pendente). O card de MRR permanece inalterado. Substituir os outros dois e adicionar o card de Total:

```tsx
{/* Cards de resumo */}
<div className="grid grid-cols-3 gap-3 mb-4">
  <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">MRR</p>
    <p className="text-white text-lg font-bold">{formatCurrency(mrr)}</p>
  </div>
  <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Recebido</p>
    <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalReceived)}</p>
    <p className="text-slate-500 text-xs mt-1">
      {filteredTransactions.filter((t) => t.type === 'received').length} transação(ões)
    </p>
  </div>
  <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Pendente</p>
    <p className="text-amber-400 text-lg font-bold">{formatCurrency(totalPending)}</p>
    <p className="text-slate-500 text-xs mt-1">
      {filteredTransactions.filter((t) => t.type === 'pending').length} transação(ões)
    </p>
  </div>
</div>
```

- [ ] **Step 7: Adicionar barra de filtros FN1**

Após os cards de resumo, antes da linha que renderiza a lista ou o form, adicionar:

```tsx
{/* Filtros — FN1 */}
<div className="flex gap-2 flex-wrap mb-4">
  <select
    value={filterType}
    onChange={(e) => setFilterType(e.target.value as 'all' | 'received' | 'pending')}
    className="bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
  >
    <option value="all">Todos os tipos</option>
    <option value="received">Recebido</option>
    <option value="pending">Pendente</option>
  </select>
  <select
    value={filterClientId}
    onChange={(e) => setFilterClientId(e.target.value)}
    className="bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
  >
    <option value="">Todos os clientes</option>
    {clients.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}{c.company ? ` — ${c.company}` : ''}
      </option>
    ))}
  </select>
  <select
    value={filterMonth}
    onChange={(e) => setFilterMonth(e.target.value)}
    className="bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
  >
    <option value="">Todos os períodos</option>
    {monthOptions.map((m) => (
      <option key={m.value} value={m.value}>{m.label}</option>
    ))}
  </select>
  {(filterType !== 'all' || filterClientId || filterMonth) && (
    <button
      onClick={() => { setFilterType('all'); setFilterClientId(''); setFilterMonth('') }}
      className="text-slate-500 hover:text-slate-300 text-sm px-2 transition-colors"
    >
      Limpar filtros ×
    </button>
  )}
</div>
```

- [ ] **Step 8: Adicionar view "Por cliente" (FN4)**

Após a barra de filtros, envolver a lista de transações existente + o botão "Registrar" com uma condicional de view:

```tsx
{activeView === 'by_client' ? (
  <div className="space-y-2">
    {(() => {
      // Agrupar filteredTransactions por client_id
      const map = new Map<string, { name: string; company: string | null; received: number; pending: number; count: number }>()
      for (const t of filteredTransactions) {
        const key = t.client_id
        if (!map.has(key)) {
          map.set(key, {
            name: t.clients?.name ?? 'Desconhecido',
            company: t.clients?.company ?? null,
            received: 0,
            pending: 0,
            count: 0,
          })
        }
        const entry = map.get(key)!
        entry.count++
        if (t.type === 'received') entry.received += t.amount
        else entry.pending += t.amount
      }
      const sorted = Array.from(map.values()).sort((a, b) => (b.received + b.pending) - (a.received + a.pending))
      if (sorted.length === 0) {
        return <div className="text-center py-12 text-slate-500 text-sm">Nenhuma transação com os filtros aplicados.</div>
      }
      return sorted.map((c, i) => (
        <div key={i} className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3">
          <div>
            <p className="text-white text-sm font-medium">{c.name}</p>
            {c.company && <p className="text-slate-400 text-xs">{c.company}</p>}
            <p className="text-slate-500 text-xs mt-0.5">{c.count} transação(ões)</p>
          </div>
          <div className="text-right">
            <p className="text-emerald-400 text-sm font-semibold">{formatCurrency(c.received)}</p>
            {c.pending > 0 && (
              <p className="text-amber-400 text-xs">{formatCurrency(c.pending)} pendente</p>
            )}
          </div>
        </div>
      ))
    })()}
  </div>
) : (
  /* ... todo o JSX existente de listagem de transações e form de add ... */
)}
```

**Atenção:** O bloco `activeView === 'transactions'` deve envolver: o botão "Registrar pagamento", o form de add (se showAddForm), e a lista de transações.

- [ ] **Step 9: Verificar no browser**

Abrir `/financial`. Testar:
- Filtrar por tipo "Pendente" → totais mudam
- Filtrar por cliente específico → só aparece transações desse cliente
- Filtrar por mês → lista e totais filtrados
- Botão "Limpar filtros ×" aparece e funciona
- Aba "Por cliente" → breakdown correto
- Voltar para aba "Transações" → lista normal

- [ ] **Step 10: Commit**

```bash
git add components/financial/TransactionManager.tsx
git commit -m "feat: add transaction filters (FN1) and by-client breakdown (FN4)"
```

---

### Task 3: A1 — Filtro de Tipo no Histórico de Interações

**Files:**
- Modify: `components/clients/folder/HistoryTab.tsx`

**Contexto:** HistoryTab busca interações de um cliente via `GET /api/clients/${clientId}/interactions` e as exibe em ordem cronológica. A1 adiciona botões de filtro rápido por tipo (Nota / Reunião / Email), idêntico ao padrão do TaskList.

- [ ] **Step 1: Adicionar estado de filtro**

Dentro do componente `HistoryTab`, após a linha `const confirm = useConfirm()`, adicionar:

```tsx
const [filterType, setFilterType] = useState<'all' | 'note' | 'meeting' | 'email'>('all')
```

- [ ] **Step 2: Computar lista filtrada**

Após a linha `const [saving, setSaving] = useState(false)`, adicionar:

```tsx
const filteredInteractions = filterType === 'all'
  ? interactions
  : interactions.filter((i) => i.type === filterType)
```

- [ ] **Step 3: Adicionar botões de filtro no JSX**

Localizar a área que exibe o botão "Registrar interação" ou o header do componente. Adicionar acima da lista de interações (após o form de add, se visível):

```tsx
{/* Filtros por tipo */}
<div className="flex gap-2 flex-wrap mb-3">
  {(['all', 'note', 'meeting', 'email'] as const).map((f) => (
    <button
      key={f}
      onClick={() => setFilterType(f)}
      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
        filterType === f
          ? 'bg-indigo-600 text-white'
          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
      }`}
    >
      {f === 'all'
        ? `Todas (${interactions.length})`
        : TYPE_LABELS[f as InteractionType]}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Atualizar renderização para usar `filteredInteractions`**

Localizar onde `interactions.map(...)` é usado para renderizar a lista. Substituir `interactions` por `filteredInteractions` nesse map. Manter o EmptyState existente para quando `filteredInteractions.length === 0`.

Se o EmptyState atual usa `interactions.length === 0`, atualizar para:
```tsx
{filteredInteractions.length === 0 ? (
  interactions.length === 0 ? (
    <EmptyState
      icon="💬"
      title="Nenhuma interação registrada"
      description="Registre notas, reuniões e emails para acompanhar o relacionamento."
    />
  ) : (
    <div className="text-center py-8 text-slate-500 text-sm">
      Nenhuma interação do tipo selecionado.
    </div>
  )
) : (
  filteredInteractions.map((interaction) => { /* ... renderização existente ... */ })
)}
```

- [ ] **Step 5: Verificar no browser**

Abrir pasta de um cliente com histórico. Testar:
- Botão "Reunião" → só mostra reuniões
- Botão "Nota" → só notas
- "Todas" → volta tudo
- Filtro com 0 resultados mostra mensagem correta

- [ ] **Step 6: Commit**

```bash
git add components/clients/folder/HistoryTab.tsx
git commit -m "feat: add interaction type filter to HistoryTab (A1)"
```

---

### Task 4: C1+C2 — Filtro de Status e Ordenação na Lista de Clientes

**Files:**
- Modify: `components/clients/ClientList.tsx`

**Contexto:** ClientList já tem busca por texto e exibe `lastContactLabel`. C1 adiciona chips de filtro por status (Ativo/Inativo/Churned). C2 adiciona dropdown de ordenação (nome, MRR, último contato). A ordenação por "último contato" usa a prop `lastInteractions` já disponível.

- [ ] **Step 1: Adicionar estado de filtro e ordenação**

Dentro do componente `ClientList`, após `const [isAddModalOpen, setIsAddModalOpen] = useState(false)`, adicionar:

```tsx
const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'churned'>('all')
const [sortBy, setSortBy] = useState<'default' | 'name' | 'mrr' | 'lastContact'>('default')
```

- [ ] **Step 2: Atualizar pipeline de derivação**

Substituir a constante `filtered` atual:

```tsx
const filtered = clients.filter(
  (c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? '').toLowerCase().includes(search.toLowerCase())
)
```

Por:

```tsx
const filtered = clients
  .filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(search.toLowerCase())
  )
  .filter((c) => filterStatus === 'all' || c.status === filterStatus)

const sorted = [...filtered].sort((a, b) => {
  if (sortBy === 'name') return a.name.localeCompare(b.name, 'pt-BR')
  if (sortBy === 'mrr') return b.monthly_value - a.monthly_value
  if (sortBy === 'lastContact') {
    const aDate = lastInteractions[a.id] ?? ''
    const bDate = lastInteractions[b.id] ?? ''
    return bDate.localeCompare(aDate)
  }
  return 0
})
```

- [ ] **Step 3: Adicionar chips de status e dropdown de ordenação no JSX**

Logo abaixo da `<div className="flex gap-3 mb-4">` (barra de busca + botão), adicionar:

```tsx
{/* C1+C2 — Filtro de status + ordenação */}
<div className="flex items-center justify-between mb-3 flex-wrap gap-2">
  <div className="flex gap-1.5 flex-wrap">
    {(['all', 'active', 'inactive', 'churned'] as const).map((s) => (
      <button
        key={s}
        onClick={() => setFilterStatus(s)}
        className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
          filterStatus === s
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
        }`}
      >
        {s === 'all' ? `Todos (${clients.length})` : STATUS_BADGE[s as ClientStatus].label}
      </button>
    ))}
  </div>
  <select
    value={sortBy}
    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
    className="bg-[#1e293b] border border-slate-700 text-slate-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
  >
    <option value="default">Padrão (mais recente)</option>
    <option value="name">Nome A→Z</option>
    <option value="mrr">MRR (maior)</option>
    <option value="lastContact">Último contato</option>
  </select>
</div>
```

- [ ] **Step 4: Atualizar referência de `filtered` para `sorted` no JSX**

Localizar onde `filtered.map((client) => ...)` é usado. Substituir `filtered` por `sorted`.

Atualizar também a condição do empty state:
```tsx
{sorted.length === 0 ? (
  search || filterStatus !== 'all' ? (
    <div className="text-center py-12 text-slate-500 text-sm">
      Nenhum cliente encontrado.
    </div>
  ) : (
    <EmptyState
      icon="👥"
      title="Nenhum cliente ainda"
      description="Adicione seu primeiro cliente para organizar projetos e receitas."
      action={{ label: '+ Novo Cliente', onClick: () => setIsAddModalOpen(true) }}
    />
  )
) : (
  sorted.map((client) => { /* ... renderização existente ... */ })
)}
```

- [ ] **Step 5: Verificar no browser**

Abrir `/clients`. Testar:
- Chip "Ativo" → só clientes ativos
- Chip "Churned" → só churned
- Ordenar por "MRR" → clientes mais caros primeiro
- Ordenar por "Último contato" → mais recente primeiro
- Combinar busca por texto + filtro de status

- [ ] **Step 6: Commit**

```bash
git add components/clients/ClientList.tsx
git commit -m "feat: add status filter and sort to client list (C1+C2)"
```

---

### Task 5: PR1 — Cards de Resumo nas Propostas

**Files:**
- Modify: `components/proposals/ProposalList.tsx`

**Contexto:** ProposalList já tem filtros por status (Todas/Rascunho/Enviada/Aprovada/Recusada). PR1 adiciona 3 cards de resumo acima desses filtros, calculados sobre TODAS as propostas (não a lista filtrada).

- [ ] **Step 1: Computar totais**

Dentro do componente `ProposalList`, após `const [filter, setFilter] = useState(...)`, adicionar:

```tsx
// PR1 — totais calculados sobre TODAS as propostas
const totalApproved = proposals
  .filter((p) => p.status === 'approved')
  .reduce((s, p) => s + p.value, 0)
const totalSent = proposals
  .filter((p) => p.status === 'sent')
  .reduce((s, p) => s + p.value, 0)
const nApproved = proposals.filter((p) => p.status === 'approved').length
const nSent = proposals.filter((p) => p.status === 'sent').length
const nRejected = proposals.filter((p) => p.status === 'rejected').length
const convRate =
  nApproved + nRejected > 0
    ? Math.round((nApproved / (nApproved + nRejected)) * 100)
    : null
```

- [ ] **Step 2: Adicionar cards de resumo no JSX**

No início do `return (...)`, antes do `<div className="flex items-center justify-between mb-4">` (que contém os filtros e o botão "Nova Proposta"), adicionar:

```tsx
{/* PR1 — Cards de resumo */}
{proposals.length > 0 && (
  <div className="grid grid-cols-3 gap-3 mb-4">
    <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Aprovado</p>
      <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalApproved)}</p>
      <p className="text-slate-500 text-xs mt-1">{nApproved} proposta(s)</p>
    </div>
    <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Em Negociação</p>
      <p className="text-amber-400 text-lg font-bold">{formatCurrency(totalSent)}</p>
      <p className="text-slate-500 text-xs mt-1">{nSent} proposta(s)</p>
    </div>
    <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Taxa de Conversão</p>
      <p className="text-white text-lg font-bold">
        {convRate !== null ? `${convRate}%` : '—'}
      </p>
      <p className="text-slate-500 text-xs mt-1">aprovadas / (apr + rec)</p>
    </div>
  </div>
)}
```

- [ ] **Step 3: Verificar no browser**

Abrir `/proposals`. Verificar:
- 3 cards aparecem quando há propostas
- Total Aprovado somou corretamente as aprovadas
- Em Negociação somou as enviadas
- Taxa de conversão está correta (ou "—" se não há aprovadas nem recusadas)
- Cards não aparecem quando lista está vazia (EmptyState)

- [ ] **Step 4: Commit**

```bash
git add components/proposals/ProposalList.tsx
git commit -m "feat: add summary cards to ProposalList (PR1)"
```

---

## Checklist de spec coverage

- [x] T1: agrupamento por status/prioridade/cliente, colapsável — Tasks 1
- [x] FN1: filtros tipo/cliente/mês com totais dinâmicos — Task 2
- [x] FN4: aba "Por cliente" com breakdown — Task 2
- [x] A1: filtro por tipo (nota/reunião/email) — Task 3
- [x] C1: chips de status (ativo/inativo/churned) — Task 4
- [x] C2: dropdown de ordenação (nome/MRR/último contato) — Task 4
- [x] PR1: cards de resumo (aprovado/enviado/conversão) — Task 5
