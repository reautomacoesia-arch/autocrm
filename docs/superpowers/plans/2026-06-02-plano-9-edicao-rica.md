# Pacote 3 — Edição Rica: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar edição inline em 4 pontos do AutoCRM: card do Kanban, header da pasta do cliente, itens da proposta e título da tarefa.

**Architecture:** Estado local `isEditing` em cada componente. Sem modais novos, sem abstrações compartilhadas. Click/double-click → input substitui texto → PATCH/POST/DELETE → atualiza estado local. Todas as APIs necessárias já existem.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, React (useState), Lucide React

> **Nota:** Sem suite de testes. Padrão: Implementar → Verificar no browser → Commit.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `components/pipeline/KanbanCard.tsx` | Modificar — P8 inline edit |
| `components/pipeline/KanbanColumn.tsx` | Modificar — P8 repasse de prop |
| `components/pipeline/KanbanBoard.tsx` | Modificar — P8 nova prop |
| `components/clients/folder/ClientFolder.tsx` | Modificar — F2 header editável |
| `components/proposals/ProposalDetail.tsx` | Modificar — PR7 editar itens |
| `app/(dashboard)/proposals/[id]/page.tsx` | Modificar — PR7 buscar serviços |
| `components/tasks/TaskList.tsx` | Modificar — T8 double-click título |

---

### Task 1: P8 — KanbanCard Inline Edit

**Files:**
- Modify: `components/pipeline/KanbanCard.tsx`
- Modify: `components/pipeline/KanbanColumn.tsx`
- Modify: `components/pipeline/KanbanBoard.tsx`

**Contexto:** Hoje clicar em um card abre `EditLeadModal`. Após esta tarefa, clicar em um card (não-won) expande o card inline com um form. Cards won continuam abrindo `ConvertToClientModal` via `onEdit`. A prop `onEdit` em KanbanCard continua existindo mas só é chamada para leads won.

KanbanColumn atual passa `onEdit={onCardEdit}` e `onDelete={onCardDelete}` para KanbanCard. Precisamos adicionar `onLeadUpdated`.

- [ ] **Step 1: Ler `components/pipeline/KanbanCard.tsx` antes de editar**

Ler o arquivo completo para entender a estrutura atual.

- [ ] **Step 2: Substituir `KanbanCard.tsx` pelo seguinte conteúdo completo**

```tsx
'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import type { Lead } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, DollarSign, X, MessageCircle } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface KanbanCardProps {
  lead: Lead
  index: number
  onEdit: (lead: Lead) => void
  onDelete: (leadId: string) => void
  onLeadUpdated: (updated: Lead) => void
}

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export default function KanbanCard({ lead, index, onEdit, onDelete, onLeadUpdated }: KanbanCardProps) {
  const confirm = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: lead.name,
    company: lead.company ?? '',
    estimated_value: String(lead.estimated_value),
    phone: lead.phone ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await confirm({
      title: `Remover o lead "${lead.name}"?`,
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (ok) {
      onDelete(lead.id)
    }
  }

  function handleWhatsApp(e: React.MouseEvent) {
    e.stopPropagation()
    if (lead.phone) {
      const number = cleanPhone(lead.phone)
      window.open(`https://wa.me/55${number}`, '_blank')
    }
  }

  function handleCardClick() {
    if (lead.stage === 'won') {
      onEdit(lead)
    } else {
      setEditForm({
        name: lead.name,
        company: lead.company ?? '',
        estimated_value: String(lead.estimated_value),
        phone: lead.phone ?? '',
      })
      setIsEditing(true)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (saving) return
    setSaving(true)
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
    setSaving(false)
  }

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={isEditing ? undefined : handleCardClick}
          className={`bg-[#0f172a] border rounded-lg p-3 select-none transition-shadow relative ${
            isEditing
              ? 'border-indigo-500 cursor-default'
              : snapshot.isDragging
              ? 'border-indigo-500 shadow-lg shadow-indigo-900/20 cursor-pointer'
              : 'border-slate-700 hover:border-slate-600 cursor-pointer'
          }`}
        >
          {isEditing ? (
            <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()}>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                required
                autoFocus
                className="w-full bg-[#1e293b] border border-slate-600 text-white rounded px-2 py-1 text-sm mb-2 focus:outline-none focus:border-indigo-500"
                placeholder="Nome *"
              />
              <input
                value={editForm.company}
                onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
                className="w-full bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:border-indigo-500"
                placeholder="Empresa"
              />
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.estimated_value}
                  onChange={(e) => setEditForm((p) => ({ ...p, estimated_value: e.target.value }))}
                  className="bg-[#1e293b] border border-slate-600 text-emerald-400 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="Valor (R$)"
                />
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                  placeholder="Telefone"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsEditing(false) }}
                  className="flex-1 text-slate-500 border border-slate-700 rounded py-1 text-xs hover:border-slate-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded py-1 text-xs font-medium transition-colors"
                >
                  {saving ? '...' : 'Salvar'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <button
                onClick={handleDelete}
                className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition-colors"
                title="Remover lead"
              >
                <X size={13} />
              </button>

              <p className="text-white text-sm font-medium truncate pr-5">{lead.name}</p>
              {lead.company && (
                <div className="flex items-center gap-1 mt-1">
                  <Building2 size={11} className="text-slate-500 flex-shrink-0" />
                  <p className="text-slate-400 text-xs truncate">{lead.company}</p>
                </div>
              )}
              {lead.estimated_value > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <DollarSign size={11} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-emerald-400 text-xs font-medium">
                    {formatCurrency(lead.estimated_value)}
                  </p>
                </div>
              )}
              {lead.phone && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleWhatsApp}
                    className="flex items-center gap-1 text-emerald-600 hover:text-emerald-400 transition-colors"
                    title={`WhatsApp: ${lead.phone}`}
                  >
                    <MessageCircle size={13} />
                    <span className="text-xs">WhatsApp</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Draggable>
  )
}
```

- [ ] **Step 3: Atualizar `KanbanColumn.tsx` — adicionar `onCardUpdated` prop**

Substituir o conteúdo de `KanbanColumn.tsx`:

```tsx
'use client'

import { Droppable } from '@hello-pangea/dnd'
import type { Lead, LeadStage } from '@/lib/types'
import { STAGE_LABELS, STAGE_COLORS, formatCurrency } from '@/lib/pipeline'
import KanbanCard from './KanbanCard'

interface KanbanColumnProps {
  stage: LeadStage
  leads: Lead[]
  onCardEdit: (lead: Lead) => void
  onCardDelete: (leadId: string) => void
  onCardUpdated: (updated: Lead) => void
}

export default function KanbanColumn({ stage, leads, onCardEdit, onCardDelete, onCardUpdated }: KanbanColumnProps) {
  const totalValue = leads.reduce((sum, lead) => sum + lead.estimated_value, 0)

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${STAGE_COLORS[stage]}`}>
            {STAGE_LABELS[stage]}
          </h3>
          <div className="flex items-center gap-1.5">
            {totalValue > 0 && (
              <span className="text-emerald-400 text-xs font-semibold">
                {formatCurrency(totalValue)}
              </span>
            )}
            <span className="text-slate-500 text-xs bg-slate-800 px-2 py-0.5 rounded-full">
              {leads.length}
            </span>
          </div>
        </div>
      </div>

      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-32 rounded-lg p-2 space-y-2 transition-colors ${
              snapshot.isDraggingOver ? 'bg-slate-800/50' : 'bg-slate-800/20'
            }`}
          >
            {leads.map((lead, index) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                index={index}
                onEdit={onCardEdit}
                onDelete={onCardDelete}
                onLeadUpdated={onCardUpdated}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}
```

- [ ] **Step 4: Atualizar `KanbanBoard.tsx` — passar `onCardUpdated`**

Localizar onde KanbanColumn é renderizado (dentro do `STAGES.map`). Adicionar a prop `onCardUpdated`:

```tsx
<KanbanColumn
  key={stage}
  stage={stage}
  leads={leadsByStage[stage]}
  onCardEdit={handleCardEdit}
  onCardDelete={handleLeadDeleted}
  onCardUpdated={handleLeadUpdated}
/>
```

`handleLeadUpdated` já existe em KanbanBoard (atualiza o lead no array `leads` e fecha o modal).

- [ ] **Step 5: Verificar no browser**

Abrir `/pipeline`. Testar:
- Clicar num card não-won → expande com form
- Editar nome/empresa/valor/telefone → clicar "Salvar" → card atualiza sem modal
- Clicar "Cancelar" → form fecha, dados originais mantidos
- Clicar num card won → abre ConvertToClientModal como antes
- Arrastar card entre colunas → continua funcionando

- [ ] **Step 6: Commit**

```bash
git add components/pipeline/KanbanCard.tsx components/pipeline/KanbanColumn.tsx components/pipeline/KanbanBoard.tsx
git commit -m "feat: inline edit for Kanban cards (P8)"
```

---

### Task 2: F2 — Header Editável do Cliente

**Files:**
- Modify: `components/clients/folder/ClientFolder.tsx`

**Contexto:** ClientFolder.tsx já tem estado `client` e `setClient`. Já usa `useToast`. Já importa ícones de lucide-react. Precisamos adicionar `Pencil` ao import, e adicionar estado + lógica de edição inline do nome e empresa no header.

- [ ] **Step 1: Ler `components/clients/folder/ClientFolder.tsx` antes de editar**

Ler o arquivo completo para entender a estrutura atual do header.

- [ ] **Step 2: Adicionar `Pencil` ao import de lucide-react**

Localizar:
```tsx
import { Building2, DollarSign, Mail, Pause, Phone, Play, Trash2 } from 'lucide-react'
```

Adicionar `Pencil`:
```tsx
import { Building2, DollarSign, Mail, Pause, Pencil, Phone, Play, Trash2 } from 'lucide-react'
```

- [ ] **Step 3: Adicionar estado de edição do header dentro do componente**

Após a linha `const router = useRouter()`, adicionar:

```tsx
const [isEditingHeader, setIsEditingHeader] = useState(false)
const [headerForm, setHeaderForm] = useState({ name: '', company: '' })
const [headerSaving, setHeaderSaving] = useState(false)
```

- [ ] **Step 4: Adicionar função `handleHeaderSave`**

Após a função `handleDelete` existente, adicionar:

```tsx
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
  } else {
    toast('Erro ao salvar', 'error')
  }
  setHeaderSaving(false)
}
```

- [ ] **Step 5: Substituir a exibição estática de nome/empresa no header**

No JSX do header, localizar o bloco:
```tsx
<div>
  <h1 className="text-white text-xl font-bold">{client.name}</h1>
  <div className="flex items-center gap-3 mt-1 flex-wrap">
    {client.company && (
      <span className="flex items-center gap-1 text-slate-400 text-sm">
        <Building2 size={13} />
        {client.company}
      </span>
    )}
    {/* ... email, phone ... */}
  </div>
</div>
```

Substituir **somente** o `<div>` que contém o nome + company + contact info por:

```tsx
<div>
  {isEditingHeader ? (
    <form onSubmit={handleHeaderSave} className="flex flex-col gap-2 min-w-[260px]">
      <input
        value={headerForm.name}
        onChange={(e) => setHeaderForm((p) => ({ ...p, name: e.target.value }))}
        required
        autoFocus
        className="bg-[#0f172a] border border-indigo-500 text-white rounded-lg px-3 py-1.5 text-lg font-bold focus:outline-none w-full"
        placeholder="Nome do cliente *"
      />
      <input
        value={headerForm.company}
        onChange={(e) => setHeaderForm((p) => ({ ...p, company: e.target.value }))}
        className="bg-[#0f172a] border border-slate-600 text-slate-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-full focus:border-indigo-500"
        placeholder="Empresa"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsEditingHeader(false)}
          className="text-slate-400 border border-slate-700 rounded-lg px-3 py-1 text-xs hover:border-slate-500 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={headerSaving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
        >
          {headerSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  ) : (
    <div className="group">
      <div className="flex items-center gap-2">
        <h1 className="text-white text-xl font-bold">{client.name}</h1>
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
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        {client.company && (
          <span className="flex items-center gap-1 text-slate-400 text-sm">
            <Building2 size={13} />
            {client.company}
          </span>
        )}
        {client.email && (
          <span className="flex items-center gap-1 text-slate-400 text-sm">
            <Mail size={13} />
            {client.email}
          </span>
        )}
        {client.phone && (
          <span className="flex items-center gap-1 text-slate-400 text-sm">
            <Phone size={13} />
            {client.phone}
          </span>
        )}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 6: Verificar no browser**

Abrir a pasta de um cliente. Testar:
- Hover sobre o nome → ícone ✏️ aparece
- Clicar no ✏️ → inputs aparecem com nome e empresa preenchidos
- Editar e salvar → nome/empresa atualizam no header + toast "Dados atualizados"
- Cancelar → modo view volta sem salvar

- [ ] **Step 7: Commit**

```bash
git add components/clients/folder/ClientFolder.tsx
git commit -m "feat: inline edit for client name and company in header (F2)"
```

---

### Task 3: PR7 — Editar Itens da Proposta

**Files:**
- Modify: `app/(dashboard)/proposals/[id]/page.tsx`
- Modify: `components/proposals/ProposalDetail.tsx`

**Contexto:** A rota `POST /api/proposals/[id]/items` e `DELETE /api/proposals/[id]/items` já existem. ProposalDetail recebe `proposal` com `proposal_items` incluídos. Precisamos passar a lista de serviços disponíveis e adicionar UI de add/remove de itens (só quando status = draft).

API de items:
- `POST /api/proposals/${id}/items` — body: `{ service_id, price }` → retorna item com `services(name)`
- `DELETE /api/proposals/${id}/items` — body: `{ item_id }` → remove o item

- [ ] **Step 1: Modificar `app/(dashboard)/proposals/[id]/page.tsx`**

Ler o arquivo (já lido — conteúdo atual: busca proposal com joins, renderiza `<ProposalDetail proposal={...} />`).

Adicionar busca de serviços e passar como prop:

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProposalDetail from '@/components/proposals/ProposalDetail'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProposalPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: proposal }, { data: services }] = await Promise.all([
    supabase
      .from('proposals')
      .select(`
        *,
        clients(id, name, company, email),
        leads(id, name, company, email),
        proposal_items(*, services(name))
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('services')
      .select('id, name, default_price')
      .order('name'),
  ])

  if (!proposal) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link href="/proposals" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
          ← Propostas
        </Link>
      </div>
      <ProposalDetail proposal={proposal as any} services={services ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Atualizar interface e props em `ProposalDetail.tsx`**

Ler o arquivo completo antes de editar.

Adicionar tipo `Service` e atualizar `ProposalDetailProps`:

```tsx
interface Service {
  id: string
  name: string
  default_price: number
}

interface ProposalDetailProps {
  proposal: ProposalWithRelations
  services: Service[]
}

export default function ProposalDetail({ proposal: initial, services }: ProposalDetailProps) {
```

- [ ] **Step 3: Adicionar import de `X` do lucide-react**

Localizar:
```tsx
import { Pencil } from 'lucide-react'
```
Substituir por:
```tsx
import { Pencil, X } from 'lucide-react'
```

- [ ] **Step 4: Adicionar estado de add form**

Dentro do componente, após as declarações de estado existentes, adicionar:

```tsx
const [addForm, setAddForm] = useState({ serviceId: '', price: '' })
const [addSaving, setAddSaving] = useState(false)
```

- [ ] **Step 5: Adicionar `handleAddItem` e `handleRemoveItem`**

Após `deleteProposal`, adicionar:

```tsx
async function handleAddItem(e: React.FormEvent) {
  e.preventDefault()
  if (!addForm.serviceId || !addForm.price || addSaving) return
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
  } else {
    toast('Erro ao adicionar item', 'error')
  }
  setAddSaving(false)
}

async function handleRemoveItem(itemId: string) {
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

- [ ] **Step 6: Substituir a seção "Items" no JSX**

Localizar o bloco `{/* Items */}` (começa em `<div className="mb-6">` com `<h2>Itens da Proposta</h2>`). Substituir por:

```tsx
{/* Items */}
<div className="mb-6">
  <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
    Itens da Proposta
  </h2>
  <div className="space-y-2">
    {proposal.proposal_items.map((item) => (
      <div
        key={item.id}
        className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
      >
        <div>
          <p className="text-white text-sm">
            {item.custom_description ?? item.services?.name ?? 'Item sem descrição'}
          </p>
          {item.services && item.custom_description && (
            <p className="text-slate-500 text-xs">{item.services.name}</p>
          )}
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <p className="text-emerald-400 text-sm font-semibold">
            {formatCurrency(item.price)}
          </p>
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
    <form onSubmit={handleAddItem} className="flex gap-2 mt-3">
      <select
        value={addForm.serviceId}
        onChange={(e) => {
          const svc = services.find((s) => s.id === e.target.value)
          setAddForm((p) => ({
            ...p,
            serviceId: e.target.value,
            price: svc && svc.default_price > 0 ? String(svc.default_price) : p.price,
          }))
        }}
        required
        className="flex-1 bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
      >
        <option value="">Selecionar serviço...</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
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
        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {addSaving ? '...' : '+ Adicionar'}
      </button>
    </form>
  )}

  <div className="flex justify-end mt-3 pt-3 border-t border-slate-700">
    <p className="text-white font-bold">
      Total:{' '}
      <span className="text-emerald-400">{formatCurrency(proposal.value)}</span>
    </p>
  </div>
</div>
```

- [ ] **Step 7: Verificar no browser**

Abrir uma proposta em status Rascunho. Testar:
- Itens existentes mostram botão ✕
- Clicar ✕ → item some otimisticamente + toast "Item removido"
- Dropdown de serviços mostra lista de serviços cadastrados
- Selecionar serviço → preço padrão preenche automaticamente
- Digitar preço + clicar "+ Adicionar" → item aparece na lista + toast "Item adicionado"
- Abrir proposta com status Enviada → sem botões ✕ e sem form de adicionar

- [ ] **Step 8: Commit**

```bash
git add app/(dashboard)/proposals/[id]/page.tsx components/proposals/ProposalDetail.tsx
git commit -m "feat: add/remove proposal items inline when draft (PR7)"
```

---

### Task 4: T8 — Double-click no Título da Tarefa

**Files:**
- Modify: `components/tasks/TaskList.tsx`

**Contexto:** TaskList.tsx tem uma função `renderTask(task: Task)` extraída no Pacote 2. O título da tarefa é exibido dentro desta função. T8 adiciona edição inline do título via double-click (click simples continua expandindo).

- [ ] **Step 1: Adicionar estado de edição de título**

Dentro do componente `TaskList`, após as declarações de estado existentes, adicionar:

```tsx
const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
const [editingTitle, setEditingTitle] = useState('')
```

- [ ] **Step 2: Adicionar `handleSaveTitle`**

Após a função `handleTaskCreated`, adicionar:

```tsx
async function handleSaveTitle(taskId: string) {
  if (!editingTitle.trim()) {
    setEditingTitleId(null)
    return
  }
  const newTitle = editingTitle.trim()
  setTasks((prev) =>
    prev.map((t) => (t.id === taskId ? { ...t, title: newTitle } : t))
  )
  setEditingTitleId(null)
  await fetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: newTitle }),
  })
}
```

- [ ] **Step 3: Atualizar `renderTask` para suportar edição de título**

Dentro da função `renderTask(task: Task)`, localizar onde o título da tarefa é exibido. O título é exibido como um `<button>` que ao clicar expande a tarefa. Substituir esse element por um condicional:

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
    onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
    onDoubleClick={(e) => {
      e.stopPropagation()
      setEditingTitleId(task.id)
      setEditingTitle(task.title)
    }}
    className="text-white text-sm font-medium text-left w-full"
    title="Duplo-clique para editar o título"
  >
    {task.title}
  </button>
)}
```

**Atenção:** O título atual em `renderTask` é um `<button onClick={() => setExpandedId(...) }>`. Preserve essa lógica no `onClick` do button, adicionando apenas o `onDoubleClick`.

- [ ] **Step 4: Verificar no browser**

Abrir `/tasks`. Testar:
- Click simples no título → expande a tarefa (comportamento existente mantido)
- Double-click no título → input aparece com texto atual
- Editar + pressionar Enter → título atualizado + input some
- Editar + click fora (blur) → título salvo
- Pressionar Escape → edição cancelada, título original restaurado
- Com tarefas agrupadas (Pacote 2): double-click em título dentro de um grupo funciona corretamente

- [ ] **Step 5: Commit**

```bash
git add components/tasks/TaskList.tsx
git commit -m "feat: double-click to edit task title inline (T8)"
```

---

## Checklist de spec coverage

- [x] P8: KanbanCard inline edit — click expande form (nome/empresa/valor/telefone) — Task 1
- [x] P8: Won leads continuam abrindo ConvertToClientModal via onEdit — Task 1
- [x] P8: KanbanColumn repassa onLeadUpdated — Task 1
- [x] P8: KanbanBoard passa handleLeadUpdated como onCardUpdated — Task 1
- [x] F2: Pencil aparece no hover ao lado do nome — Task 2
- [x] F2: PATCH `/api/clients/${id}` com name + company — Task 2
- [x] F2: Toast "Dados atualizados" no sucesso — Task 2
- [x] PR7: Busca de serviços na página de proposta — Task 3
- [x] PR7: services passado como prop para ProposalDetail — Task 3
- [x] PR7: Add item: dropdown de serviços + input preço + botão — Task 3
- [x] PR7: Preço padrão do serviço preenche automaticamente — Task 3
- [x] PR7: Remove item: botão ✕ + optimistic update — Task 3
- [x] PR7: Controles só visíveis em status draft — Task 3
- [x] T8: Double-click no título → input inline — Task 4
- [x] T8: Single click continua expandindo — Task 4
- [x] T8: Enter/blur salva, Escape cancela — Task 4
