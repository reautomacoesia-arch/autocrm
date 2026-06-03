# Spec: Pacote 3 — Edição Rica

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase. Todos os componentes afetados são Client Components.

---

## 1. P8 — KanbanCard Inline Edit

### Arquivos
- **Modificar:** `components/pipeline/KanbanCard.tsx`
- **Modificar:** `components/pipeline/KanbanBoard.tsx`

### Comportamento atual
Click no card → `onEdit(lead)` → `KanbanBoard` abre `EditLeadModal` (para não-won) ou `ConvertToClientModal` (para won).

### Novo comportamento
- Click em card **won** → continua chamando `onEdit(lead)` → `ConvertToClientModal`
- Click em card **não-won** → expande o próprio card com um form inline
- `EditLeadModal` deixa de ser aberto (permanece no codebase mas não é instanciado para não-won)

### Estado novo em KanbanCard
```ts
isEditing: boolean           // alterna entre view e form
editForm: {
  name: string
  company: string
  estimated_value: string    // string para input, parseFloat ao salvar
  phone: string
}
```

### KanbanCard — props novas/alteradas
```ts
interface KanbanCardProps {
  lead: Lead
  index: number
  onEdit: (lead: Lead) => void           // ainda usado para won leads
  onDelete: (leadId: string) => void
  onLeadUpdated: (updated: Lead) => void // nova prop
}
```

### Lógica do card
```tsx
// onClick no Draggable div:
onClick={() => {
  if (lead.stage === 'won') {
    onEdit(lead)
  } else {
    setIsEditing(true)
    setEditForm({
      name: lead.name,
      company: lead.company ?? '',
      estimated_value: String(lead.estimated_value),
      phone: lead.phone ?? '',
    })
  }
}}
```

### handleSave
```ts
async function handleSave(e: React.FormEvent) {
  e.preventDefault()
  e.stopPropagation()
  const res = await fetch(`/api/leads/${lead.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: editForm.name,
      company: editForm.company || null,
      estimated_value: parseFloat(editForm.estimated_value) || 0,
      phone: editForm.phone || null,
      // preservar campos não editados
      email: lead.email,
      stage: lead.stage,
      notes: lead.notes,
      instagram: lead.instagram,
      website: lead.website,
    }),
  })
  if (res.ok) {
    const updated = await res.json()
    onLeadUpdated(updated)
    setIsEditing(false)
  }
}
```

### JSX do card expandido (modo edição)
```tsx
{isEditing ? (
  <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()}>
    <input
      value={editForm.name}
      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
      required
      className="w-full bg-[#0f172a] border border-slate-600 text-white rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:border-indigo-500"
      placeholder="Nome *"
    />
    <input
      value={editForm.company}
      onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
      className="w-full bg-[#0f172a] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:border-indigo-500"
      placeholder="Empresa"
    />
    <div className="grid grid-cols-2 gap-1.5 mb-2">
      <input
        type="number"
        min="0"
        step="0.01"
        value={editForm.estimated_value}
        onChange={(e) => setEditForm((p) => ({ ...p, estimated_value: e.target.value }))}
        className="bg-[#0f172a] border border-slate-600 text-emerald-400 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
        placeholder="Valor (R$)"
      />
      <input
        value={editForm.phone}
        onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
        className="bg-[#0f172a] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
        placeholder="Telefone"
      />
    </div>
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsEditing(false) }}
        className="flex-1 text-slate-500 border border-slate-700 rounded py-1 text-xs"
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded py-1 text-xs font-medium"
      >
        Salvar
      </button>
    </div>
  </form>
) : (
  /* ... JSX atual de exibição do card ... */
)}
```

### KanbanBoard — mudanças
Adicionar `onLeadUpdated` em `KanbanCard`. A prop `handleLeadUpdated` já existe em KanbanBoard:

```tsx
<KanbanCard
  key={lead.id}
  lead={lead}
  index={index}
  onEdit={onCardEdit}
  onDelete={onCardDelete}
  onLeadUpdated={handleLeadUpdated}   // nova
/>
```

KanbanColumn também recebe a nova prop e a repassa para KanbanCard.

---

## 2. F2 — Header Editável do Cliente

### Arquivo
- **Modificar:** `components/clients/folder/ClientFolder.tsx`

### Comportamento
Ícone ✏️ aparece ao lado do nome no header (hover). Click → nome e empresa viram inputs inline. Salvar: PATCH `/api/clients/${id}` com `{ name, company }`.

### Estado novo (dentro de `ClientFolder`)
```ts
isEditingHeader: boolean
headerForm: { name: string; company: string }
headerSaving: boolean
```

### handleHeaderSave
```ts
async function handleHeaderSave(e: React.FormEvent) {
  e.preventDefault()
  setHeaderSaving(true)
  const res = await fetch(`/api/clients/${client.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: headerForm.name,
      company: headerForm.company || null,
    }),
  })
  if (res.ok) {
    const updated = await res.json()
    setClient(updated)
    setIsEditingHeader(false)
    toast('Dados atualizados')
  }
  setHeaderSaving(false)
}
```

### JSX do header (modo edição)
Localizar onde `client.name` e `client.company` são exibidos no header. Substituir por:

```tsx
{isEditingHeader ? (
  <form onSubmit={handleHeaderSave} className="flex flex-col gap-2">
    <input
      value={headerForm.name}
      onChange={(e) => setHeaderForm((p) => ({ ...p, name: e.target.value }))}
      required
      className="bg-[#0f172a] border border-indigo-500 text-white rounded-lg px-3 py-1.5 text-lg font-bold focus:outline-none w-full"
    />
    <input
      value={headerForm.company}
      onChange={(e) => setHeaderForm((p) => ({ ...p, company: e.target.value }))}
      className="bg-[#0f172a] border border-slate-600 text-slate-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-full"
      placeholder="Empresa"
    />
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setIsEditingHeader(false)}
        className="text-slate-400 border border-slate-700 rounded-lg px-3 py-1 text-xs"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={headerSaving}
        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50"
      >
        {headerSaving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  </form>
) : (
  <div className="flex items-center gap-2 group">
    <div>
      <h1 className="text-white text-xl font-bold">{client.name}</h1>
      {client.company && <p className="text-slate-400 text-sm">{client.company}</p>}
    </div>
    <button
      onClick={() => {
        setHeaderForm({ name: client.name, company: client.company ?? '' })
        setIsEditingHeader(true)
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-indigo-400 p-1"
      title="Editar nome e empresa"
    >
      <Pencil size={14} />
    </button>
  </div>
)}
```

Import: adicionar `Pencil` de `lucide-react`.

---

## 3. PR7 — Editar Itens da Proposta

### Arquivo
- **Modificar:** `components/proposals/ProposalDetail.tsx`

### APIs já existentes
- `POST /api/proposals/[id]/items` — body: `{ service_id, custom_description, price }`
  - Retorna o item criado com `services(name)` incluído
- `DELETE /api/proposals/[id]/items` — body: `{ item_id }`

### Comportamento
Só exibe controles de edição quando `proposal.status === 'draft'`.

### Estado novo (em ProposalDetail)
```ts
addForm: { serviceId: string; price: string }
addSaving: boolean
```

`proposal.proposal_items` já está em estado local via `const [proposal, setProposal] = useState(initial)`.

### handleAddItem
```ts
async function handleAddItem(e: React.FormEvent) {
  e.preventDefault()
  if (!addForm.serviceId || !addForm.price) return
  setAddSaving(true)
  const res = await fetch(`/api/proposals/${proposal.id}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: addForm.serviceId,
      price: parseFloat(addForm.price),
    }),
  })
  if (res.ok) {
    const newItem = await res.json()
    setProposal((prev) => ({
      ...prev,
      proposal_items: [...prev.proposal_items, newItem],
    }))
    setAddForm({ serviceId: '', price: '' })
    toast('Item adicionado')
  }
  setAddSaving(false)
}
```

### handleRemoveItem
```ts
async function handleRemoveItem(itemId: string) {
  // Optimistic update
  setProposal((prev) => ({
    ...prev,
    proposal_items: prev.proposal_items.filter((i) => i.id !== itemId),
  }))
  await fetch(`/api/proposals/${proposal.id}/items`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId }),
  })
  toast('Item removido')
}
```

### Props necessárias
`ProposalDetail` atualmente recebe apenas `proposal`. Para o dropdown de serviços, precisa receber a lista de serviços disponíveis.

**Modificar `app/(dashboard)/proposals/[id]/page.tsx`** para buscar e passar serviços:
```ts
const { data: services } = await supabase.from('services').select('id, name, default_price').order('name')
// passar como prop: <ProposalDetail proposal={...} services={services ?? []} />
```

**Atualizar interface de `ProposalDetail`:**
```ts
interface Service { id: string; name: string; default_price: number }
interface ProposalDetailProps {
  proposal: ProposalWithRelations
  services: Service[]
}
```

### JSX dos itens (modo draft)
```tsx
{/* Seção de itens */}
<h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
  Itens da Proposta
</h2>
<div className="space-y-2 mb-3">
  {proposal.proposal_items.map((item) => (
    <div key={item.id} className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3">
      <div>
        <p className="text-white text-sm">
          {item.custom_description ?? item.services?.name ?? 'Item sem descrição'}
        </p>
        {item.services && item.custom_description && (
          <p className="text-slate-500 text-xs">{item.services.name}</p>
        )}
      </div>
      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        <p className="text-emerald-400 text-sm font-semibold">{formatCurrency(item.price)}</p>
        {proposal.status === 'draft' && (
          <button
            onClick={() => handleRemoveItem(item.id)}
            className="text-slate-600 hover:text-red-400 transition-colors"
            title="Remover item"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  ))}
</div>

{/* Adicionar item — só em draft */}
{proposal.status === 'draft' && (
  <form onSubmit={handleAddItem} className="flex gap-2 mb-4">
    <select
      value={addForm.serviceId}
      onChange={(e) => {
        const svc = services.find((s) => s.id === e.target.value)
        setAddForm((p) => ({
          ...p,
          serviceId: e.target.value,
          price: svc ? String(svc.default_price) : p.price,
        }))
      }}
      required
      className="flex-1 bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
    >
      <option value="">Selecionar serviço...</option>
      {services.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
    <input
      type="number"
      min="0"
      step="0.01"
      required
      value={addForm.price}
      onChange={(e) => setAddForm((p) => ({ ...p, price: e.target.value }))}
      className="w-28 bg-[#1e293b] border border-slate-700 text-emerald-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
      placeholder="R$"
    />
    <button
      type="submit"
      disabled={addSaving}
      className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
    >
      +
    </button>
  </form>
)}

{/* Total */}
<div className="flex justify-end pt-3 border-t border-slate-700">
  <p className="text-white font-bold">
    Total: <span className="text-emerald-400">{formatCurrency(proposal.value)}</span>
  </p>
</div>
```

Import: adicionar `X` de `lucide-react`.

---

## 4. T8 — Double-click no Título da Tarefa

### Arquivo
- **Modificar:** `components/tasks/TaskList.tsx`

### Comportamento
Duplo-clique no texto do título → `<input>` substitui o texto. Salvar: `Enter` ou `onBlur`. Cancelar: `Escape`. PATCH `/api/tasks/${id}` com `{ title }`.

### Estado novo (em TaskList)
```ts
editingTitleId: string | null
editingTitle: string
```

### handleSaveTitle
```ts
async function handleSaveTitle(taskId: string) {
  if (!editingTitle.trim()) {
    setEditingTitleId(null)
    return
  }
  setTasks((prev) =>
    prev.map((t) => (t.id === taskId ? { ...t, title: editingTitle } : t))
  )
  setEditingTitleId(null)
  await fetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: editingTitle.trim() }),
  })
}
```

### JSX no renderTask — substituir exibição do título
Dentro de `renderTask`, localizar onde `task.title` é exibido como texto. Substituir por:

```tsx
{editingTitleId === task.id ? (
  <input
    autoFocus
    value={editingTitle}
    onChange={(e) => setEditingTitle(e.target.value)}
    onBlur={() => handleSaveTitle(task.id)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle(task.id) }
      if (e.key === 'Escape') { setEditingTitleId(null) }
    }}
    onClick={(e) => e.stopPropagation()}
    className="bg-[#0f172a] border border-indigo-500 text-white rounded px-2 py-0.5 text-sm font-medium w-full focus:outline-none"
  />
) : (
  <button
    onDoubleClick={(e) => {
      e.stopPropagation()
      setEditingTitleId(task.id)
      setEditingTitle(task.title)
    }}
    className="text-white text-sm font-medium text-left w-full cursor-text"
    title="Duplo-clique para editar"
  >
    {task.title}
  </button>
)}
```

---

## Regras técnicas

- Todos os componentes são Client Components (`'use client'`)
- KanbanCard: formulário dentro do Draggable — todos os handlers devem ter `e.stopPropagation()` para não disparar drag
- F2: `Pencil` importado de `lucide-react`; `toast` já disponível em ClientFolder
- PR7: a prop `services` deve ser passada pelo Server Component da página de detalhes da proposta
- T8: `onBlur` salva mesmo quando o usuário clica em outro lugar; `Escape` descarta sem salvar
- Sem novas rotas de API para P8, F2, T8; sem novas rotas para PR7 (rota de items já existe)
