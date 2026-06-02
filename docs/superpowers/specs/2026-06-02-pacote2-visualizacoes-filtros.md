# Spec: Pacote 2 — Visualizações e Filtros

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase.

**Abordagem:** Client-side filtering puro em todos os componentes. Os dados já estão carregados no cliente — filtrar é computar arrays derivados. Sem chamadas de API adicionais. Consistente com padrão já usado em `TaskList` e `ProposalList`.

---

## 1. T1 — Agrupamento de Tarefas

### Arquivo
- **Modificar:** `components/tasks/TaskList.tsx`

### Estado novo
```ts
groupBy: 'none' | 'status' | 'priority' | 'client'
collapsedGroups: Set<string>   // keys dos grupos fechados
```

### Lógica de agrupamento
Quando `groupBy !== 'none'`, computar grupos a partir da lista já filtrada por status:

```ts
interface TaskGroup {
  key: string     // valor do campo agrupado (ex: 'high', 'pending', client_id)
  label: string   // label exibido (ex: 'Alta prioridade', 'Pendente', nome do cliente)
  tasks: Task[]
}
```

**Por status:** grupos na ordem `['pending', 'in_progress', 'done']` com labels `STATUS_LABEL`.
**Por prioridade:** grupos na ordem `['high', 'medium', 'low']` com labels `{ high: 'Alta prioridade', medium: 'Média prioridade', low: 'Baixa prioridade' }`.
**Por cliente:** grupos por `task.client_id`, label = `clientMap[client_id] ?? 'Sem cliente'`. Ordenar alfabeticamente pelo label.

### UI

**Dropdown "Agrupar por"** ao lado dos filtros de status existentes:
```tsx
<select value={groupBy} onChange={...} className="bg-[#1e293b] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm">
  <option value="none">Sem agrupamento</option>
  <option value="status">Por status</option>
  <option value="priority">Por prioridade</option>
  <option value="client">Por cliente</option>
</select>
```

**Header de grupo** (quando groupBy ativo):
```tsx
<button onClick={() => toggleGroup(group.key)} className="w-full flex items-center gap-2 py-2 text-left">
  <ChevronRight size={14} className={`text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{group.label}</span>
  <span className="text-slate-600 text-xs bg-slate-800 px-2 py-0.5 rounded-full">{group.tasks.length}</span>
  <div className="flex-1 h-px bg-slate-800 ml-1" />
</button>
```

Quando colapsado: não renderiza as tarefas do grupo. Quando expandido: renderiza normalmente.

Os filtros de status existentes continuam funcionando em paralelo com o agrupamento.

---

## 2. FN1+FN4 — Filtros e Breakdown no Financeiro Global

### Arquivo
- **Modificar:** `components/financial/TransactionManager.tsx`

### Estado novo
```ts
filterType: 'all' | 'received' | 'pending'   // FN1
filterClientId: string                         // FN1 — '' = todos
filterMonth: string                            // FN1 — '' = todos, 'YYYY-MM' = mês específico
activeView: 'transactions' | 'by_client'       // FN4
```

### FN1 — Filtros

Barra de filtros acima da lista de transações (3 selects em linha):

```tsx
// Tipo
<select value={filterType} onChange={...}>
  <option value="all">Todos os tipos</option>
  <option value="received">Recebido</option>
  <option value="pending">Pendente</option>
</select>

// Cliente
<select value={filterClientId} onChange={...}>
  <option value="">Todos os clientes</option>
  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
</select>

// Mês (gerar últimos 12 meses + opção "Todos")
<select value={filterMonth} onChange={...}>
  <option value="">Todos os períodos</option>
  {/* últimos 12 meses no formato "YYYY-MM", label "Jun 2026" */}
</select>
```

**Lista filtrada:**
```ts
const filtered = transactions
  .filter(t => filterType === 'all' || t.type === filterType)
  .filter(t => !filterClientId || t.client_id === filterClientId)
  .filter(t => !filterMonth || t.date.startsWith(filterMonth))
```

**Cards de totais** recalculados sobre `filtered`:
```ts
const totalReceived = filtered.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0)
const totalPending  = filtered.filter(t => t.type === 'pending').reduce((s, t) => s + t.amount, 0)
const totalAll      = totalReceived + totalPending
```

Mostrar contagem de transações em cada card (`↑ N transações`).

### FN4 — Aba "Por cliente"

View tabs acima dos filtros:
```tsx
<div className="flex gap-0 border-b border-slate-700 mb-4">
  <button onClick={() => setActiveView('transactions')} className={activeView === 'transactions' ? 'active-tab' : 'inactive-tab'}>
    📋 Transações
  </button>
  <button onClick={() => setActiveView('by_client')} className={activeView === 'by_client' ? 'active-tab' : 'inactive-tab'}>
    📊 Por cliente
  </button>
</div>
```

Na view `by_client`, agrupar `filtered` por `client_id`:
```ts
interface ClientSummary {
  clientId: string
  clientName: string
  count: number
  totalReceived: number
  totalPending: number
}
```

Ordenar por `totalReceived` decrescente. Cada linha mostra: nome do cliente, contagem, total recebido (verde), total pendente (âmbar se > 0).

Os filtros FN1 continuam ativos na view "Por cliente" — o breakdown reflete o período/tipo filtrado.

---

## 3. A1 — Filtros de Tipo no Histórico

### Arquivo
- **Modificar:** `components/clients/folder/HistoryTab.tsx`

### Estado novo
```ts
filterType: 'all' | 'note' | 'meeting' | 'email'
```

### UI

Botões de filtro rápido (mesmo padrão do TaskList) acima da lista de interações:

```tsx
{(['all', 'note', 'meeting', 'email'] as const).map(f => (
  <button
    key={f}
    onClick={() => setFilterType(f)}
    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
      filterType === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
    }`}
  >
    {f === 'all' ? `Todas (${interactions.length})` : TYPE_LABELS[f]}
  </button>
))}
```

Lista filtrada:
```ts
const filtered = filterType === 'all'
  ? interactions
  : interactions.filter(i => i.type === filterType)
```

---

## 4. C1+C2 — Filtros e Ordenação de Clientes

### Arquivo
- **Modificar:** `components/clients/ClientList.tsx`

### Estado novo
```ts
filterStatus: 'all' | 'active' | 'inactive' | 'churned'
sortBy: 'default' | 'name' | 'mrr' | 'lastContact'
```

### UI

Linha abaixo da barra de busca:

**C1 — Chips de status:**
```tsx
{(['all', 'active', 'inactive', 'churned'] as const).map(s => (
  <button key={s} onClick={() => setFilterStatus(s)} className={filterStatus === s ? 'chip-active' : 'chip-inactive'}>
    {s === 'all' ? 'Todos' : STATUS_BADGE[s].label}
  </button>
))}
```

**C2 — Dropdown de ordenação:**
```tsx
<select value={sortBy} onChange={...} className="bg-[#1e293b] border border-slate-700 ...">
  <option value="default">Padrão (mais recente)</option>
  <option value="name">Nome A→Z</option>
  <option value="mrr">MRR (maior)</option>
  <option value="lastContact">Último contato</option>
</select>
```

**Pipeline de derivação:**
```ts
const filtered = clients
  .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.company ?? '').toLowerCase().includes(search.toLowerCase()))
  .filter(c => filterStatus === 'all' || c.status === filterStatus)

const sorted = [...filtered].sort((a, b) => {
  if (sortBy === 'name') return a.name.localeCompare(b.name)
  if (sortBy === 'mrr') return b.monthly_value - a.monthly_value
  if (sortBy === 'lastContact') {
    const aDate = lastInteractions[a.id] ?? ''
    const bDate = lastInteractions[b.id] ?? ''
    return bDate.localeCompare(aDate)   // mais recente primeiro
  }
  return 0  // default: manter ordem do servidor
})
```

---

## 5. PR1 — Cards de Resumo nas Propostas

### Arquivo
- **Modificar:** `components/proposals/ProposalList.tsx`

### Lógica

Calculado sobre **todas** as propostas (não a lista filtrada):

```ts
const totalApproved = proposals.filter(p => p.status === 'approved').reduce((s, p) => s + p.value, 0)
const totalSent     = proposals.filter(p => p.status === 'sent').reduce((s, p) => s + p.value, 0)
const nApproved     = proposals.filter(p => p.status === 'approved').length
const nRejected     = proposals.filter(p => p.status === 'rejected').length
const convRate      = (nApproved + nRejected) > 0
  ? Math.round(nApproved / (nApproved + nRejected) * 100)
  : null
```

### UI

3 cards acima dos filtros de status existentes:

```tsx
<div className="grid grid-cols-3 gap-3 mb-4">
  <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Aprovado</p>
    <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalApproved)}</p>
    <p className="text-slate-500 text-xs mt-1">{nApproved} proposta(s)</p>
  </div>
  <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Em Negociação</p>
    <p className="text-amber-400 text-lg font-bold">{formatCurrency(totalSent)}</p>
    <p className="text-slate-500 text-xs mt-1">{proposals.filter(p => p.status === 'sent').length} proposta(s)</p>
  </div>
  <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Taxa de Conversão</p>
    <p className="text-white text-lg font-bold">{convRate !== null ? `${convRate}%` : '—'}</p>
    <p className="text-slate-500 text-xs mt-1">aprovadas / (apr + rec)</p>
  </div>
</div>
```

---

## Regras técnicas

- Todos os filtros são client-side (sem API calls adicionais)
- `'use client'` já presente em todos os componentes afetados
- Ordenação de clientes `lastContact` usa a prop `lastInteractions` já disponível
- Sem migrations de banco necessárias
- Os empty states existentes continuam funcionando (EmptyState mostra quando a lista **após filtro** está vazia)
