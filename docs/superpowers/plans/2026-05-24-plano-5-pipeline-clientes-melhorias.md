# Pipeline + Clientes — Melhorias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar edição/remoção de leads no Pipeline, campos de contato social (Instagram/Website/WhatsApp), e operações CRUD completas em todas as abas do ClientFolder (projetos, financeiro, histórico, tarefas), além de criar/pausar/remover clientes.

**Architecture:** Cada task é independente. Tasks 1-3 cobrem Pipeline. Tasks 4-9 cobrem Clientes. A Task 1 (DB + Types) deve ser executada primeiro pois todas as outras dependem dos novos campos. O resto pode ser executado em qualquer ordem dentro de cada grupo.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + RLS), @supabase/ssr, lucide-react

---

## REGRAS CRÍTICAS DO PROJETO (leia antes de qualquer código)

1. **`params` é uma Promise** — sempre `const { id } = await params` em route handlers
2. **NUNCA `{ ...body }` em PATCH** — liste explicitamente os campos permitidos
3. **Datas `YYYY-MM-DD`** — parse com `new Date(year, month-1, day)` (nunca `new Date(dateStr)`)
4. **Server → Client** — funções não são serializáveis, não passe como props
5. **Supabase** — sempre `await createClient()` do `@/lib/supabase/server`

---

## File Map

| Arquivo | Ação | Task |
|---------|------|------|
| `lib/types.ts` | Modify — add `instagram`, `website` to Lead; add `instagram`, `website`, `contact_name` to Client | 1 |
| `app/api/leads/[id]/route.ts` | Modify — fix PATCH allowlist (atualmente usa `{ ...body }`) | 2 |
| `app/api/clients/[id]/route.ts` | Modify — add DELETE handler | 2 |
| `app/api/clients/[id]/projects/[projectId]/route.ts` | Create — PATCH + DELETE | 2 |
| `app/api/clients/[id]/interactions/[interactionId]/route.ts` | Create — DELETE | 2 |
| `components/pipeline/AddLeadModal.tsx` | Modify — add notes, instagram, website fields | 3 |
| `components/pipeline/EditLeadModal.tsx` | Create — modal de edição completo | 3 |
| `components/pipeline/KanbanCard.tsx` | Modify — X delete button + WhatsApp button + click opens edit | 3 |
| `components/pipeline/KanbanBoard.tsx` | Modify — wire EditLeadModal, handleDelete, handleLeadUpdated | 3 |
| `app/api/clients/route.ts` | Modify — add POST handler | 4 |
| `components/clients/AddClientModal.tsx` | Create — modal novo cliente | 4 |
| `components/clients/ClientList.tsx` | Modify — add "Novo Cliente" button + AddClientModal | 4 |
| `app/(dashboard)/clients/page.tsx` | Modify — pass clients to ClientList to support optimistic add | 4 |
| `components/clients/folder/DataTab.tsx` | Create — aba Dados (instagram, website, whatsapp, contact_name) | 5 |
| `components/clients/folder/ClientFolder.tsx` | Modify — add DataTab, pause/reactivate/delete header buttons | 5 |
| `components/clients/folder/ProjectsTab.tsx` | Modify — edit inline + delete button | 6 |
| `components/clients/folder/FinancialTab.tsx` | Modify — edit transaction inline + badge "Atrasado" | 7 |
| `components/clients/folder/HistoryTab.tsx` | Modify — delete interaction button | 8 |
| `components/clients/folder/TasksTab.tsx` | Modify — edit inline + delete button | 9 |

---

## Task 1: DB Migration + Atualizar Tipos TypeScript

**Files:**
- SQL (executar no Supabase Dashboard): migrations para `leads` e `clients`
- Modify: `lib/types.ts`

- [ ] **Step 1: Executar migration SQL no Supabase**

Abrir https://supabase.com/dashboard/project/lkdsmnnvesartboloyiz/sql/new e executar:

```sql
-- Tabela leads: novos campos
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website TEXT;

-- Tabela clients: novos campos
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name TEXT;
```

- [ ] **Step 2: Atualizar `lib/types.ts` — interface Lead**

Substituir a interface `Lead` atual:

```typescript
export interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  stage: LeadStage
  estimated_value: number
  notes: string | null
  instagram: string | null
  website: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Atualizar `lib/types.ts` — interface Client**

Substituir a interface `Client` atual:

```typescript
export interface Client {
  id: string
  lead_id: string | null
  name: string
  company: string | null
  email: string | null
  phone: string | null
  monthly_value: number
  status: ClientStatus
  started_at: string | null
  referred_by: string | null
  instagram: string | null
  website: string | null
  contact_name: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add instagram/website/contact_name fields to Lead and Client types"
```

---

## Task 2: APIs Backend — Fix PATCH + Novas Rotas

**Files:**
- Modify: `app/api/leads/[id]/route.ts`
- Modify: `app/api/clients/[id]/route.ts`
- Create: `app/api/clients/[id]/projects/[projectId]/route.ts`
- Create: `app/api/clients/[id]/interactions/[interactionId]/route.ts`

- [ ] **Step 1: Corrigir PATCH de leads (allowlist explícita)**

Substituir o conteúdo de `app/api/leads/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from('leads')
    .update({
      name: body.name,
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      estimated_value: body.estimated_value ?? 0,
      stage: body.stage,
      notes: body.notes ?? null,
      instagram: body.instagram ?? null,
      website: body.website ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Adicionar DELETE em `app/api/clients/[id]/route.ts`**

Substituir o conteúdo do arquivo (mantendo GET e PATCH, corrigindo PATCH e adicionando DELETE):

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from('clients')
    .update({
      name: body.name,
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      monthly_value: body.monthly_value,
      status: body.status,
      instagram: body.instagram ?? null,
      website: body.website ?? null,
      contact_name: body.contact_name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Criar `app/api/clients/[id]/projects/[projectId]/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const supabase = await createClient()
  const { projectId } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from('projects')
    .update({
      name: body.name,
      description: body.description ?? null,
      status: body.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const supabase = await createClient()
  const { projectId } = await params

  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Criar `app/api/clients/[id]/interactions/[interactionId]/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; interactionId: string }> }
) {
  const supabase = await createClient()
  const { interactionId } = await params

  const { error } = await supabase
    .from('interactions')
    .delete()
    .eq('id', interactionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Adicionar POST em `app/api/clients/route.ts`**

Substituir o conteúdo do arquivo:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: body.name,
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      monthly_value: body.monthly_value ?? 0,
      status: body.status ?? 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/leads/[id]/route.ts app/api/clients/route.ts app/api/clients/[id]/route.ts
git add "app/api/clients/[id]/projects/[projectId]/route.ts"
git add "app/api/clients/[id]/interactions/[interactionId]/route.ts"
git commit -m "feat: fix leads PATCH allowlist, add clients DELETE/POST, project PATCH+DELETE, interaction DELETE"
```

---

## Task 3: Pipeline UI — EditLeadModal + KanbanCard + KanbanBoard

**Files:**
- Create: `components/pipeline/EditLeadModal.tsx`
- Modify: `components/pipeline/AddLeadModal.tsx`
- Modify: `components/pipeline/KanbanCard.tsx`
- Modify: `components/pipeline/KanbanBoard.tsx`

- [ ] **Step 1: Criar `components/pipeline/EditLeadModal.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import type { Lead, LeadStage } from '@/lib/types'

interface EditLeadModalProps {
  lead: Lead | null
  onClose: () => void
  onLeadUpdated: (lead: Lead) => void
}

const STAGE_OPTIONS: { value: LeadStage; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'proposal_sent', label: 'Proposta Enviada' },
  { value: 'negotiating', label: 'Negociando' },
  { value: 'won', label: 'Ganho' },
  { value: 'lost', label: 'Perdido' },
]

export default function EditLeadModal({ lead, onClose, onLeadUpdated }: EditLeadModalProps) {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    estimated_value: '',
    stage: 'lead' as LeadStage,
    notes: '',
    instagram: '',
    website: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name,
        company: lead.company ?? '',
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        estimated_value: lead.estimated_value > 0 ? String(lead.estimated_value) : '',
        stage: lead.stage,
        notes: lead.notes ?? '',
        instagram: lead.instagram ?? '',
        website: lead.website ?? '',
      })
    }
  }, [lead])

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lead) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : 0,
        stage: form.stage,
        notes: form.notes || null,
        instagram: form.instagram || null,
        website: form.website || null,
      }),
    })

    if (!res.ok) {
      setError('Erro ao salvar. Tente novamente.')
      setLoading(false)
      return
    }

    const updated = await res.json()
    onLeadUpdated(updated)
    setLoading(false)
  }

  return (
    <Modal isOpen={!!lead} onClose={onClose} title="Editar Lead">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nome *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Empresa</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Telefone / WhatsApp</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="(11) 99999-0000"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Instagram</label>
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => handleChange('instagram', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="@empresa"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="https://empresa.com.br"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Valor estimado (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_value}
              onChange={(e) => handleChange('estimated_value', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Estágio</label>
            <select
              value={form.stage}
              onChange={(e) => handleChange('stage', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Observações</label>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={3}
            placeholder="Observações sobre o lead..."
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Atualizar `components/pipeline/AddLeadModal.tsx` — adicionar campos notes, instagram, website**

Substituir o conteúdo completo do arquivo:

```typescript
'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Lead } from '@/lib/types'

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onLeadAdded: (lead: Lead) => void
}

export default function AddLeadModal({ isOpen, onClose, onLeadAdded }: AddLeadModalProps) {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    estimated_value: '',
    instagram: '',
    website: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : 0,
        instagram: form.instagram || null,
        website: form.website || null,
        notes: form.notes || null,
      }),
    })

    if (!res.ok) {
      setError('Erro ao criar lead. Tente novamente.')
      setLoading(false)
      return
    }

    const lead = await res.json()
    onLeadAdded(lead)
    setForm({ name: '', company: '', email: '', phone: '', estimated_value: '', instagram: '', website: '', notes: '' })
    setLoading(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Lead">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nome *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome do contato"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Empresa</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome da empresa"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="email@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Telefone / WhatsApp</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="(11) 99999-0000"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Instagram</label>
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => handleChange('instagram', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="@empresa"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="https://empresa.com.br"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Valor estimado (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.estimated_value}
            onChange={(e) => handleChange('estimated_value', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Observações</label>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={2}
            placeholder="Observações sobre o lead..."
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Criando...' : 'Criar Lead'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 3: Substituir `components/pipeline/KanbanCard.tsx`**

O card agora tem: X no canto superior direito (delete), ícone WhatsApp no rodapé (se phone existir), clique abre edit modal.

```typescript
'use client'

import { Draggable } from '@hello-pangea/dnd'
import type { Lead } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, DollarSign, X, MessageCircle } from 'lucide-react'

interface KanbanCardProps {
  lead: Lead
  index: number
  onEdit: (lead: Lead) => void
  onDelete: (leadId: string) => void
}

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export default function KanbanCard({ lead, index, onEdit, onDelete }: KanbanCardProps) {
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`Remover o lead "${lead.name}"?`)) {
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

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(lead)}
          className={`bg-[#0f172a] border rounded-lg p-3 cursor-pointer select-none transition-shadow relative ${
            snapshot.isDragging
              ? 'border-indigo-500 shadow-lg shadow-indigo-900/20'
              : 'border-slate-700 hover:border-slate-600'
          }`}
        >
          {/* X delete button */}
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

          {/* WhatsApp button */}
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
        </div>
      )}
    </Draggable>
  )
}
```

- [ ] **Step 4: Substituir `components/pipeline/KanbanBoard.tsx`**

Adicionar EditLeadModal, handleLeadUpdated, handleLeadDeleted, passar onEdit/onDelete para KanbanCard:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import type { Lead, LeadStage } from '@/lib/types'
import { STAGES } from '@/lib/pipeline'
import KanbanColumn from './KanbanColumn'
import AddLeadModal from './AddLeadModal'
import EditLeadModal from './EditLeadModal'
import ConvertToClientModal from './ConvertToClientModal'
import { Plus } from 'lucide-react'

interface KanbanBoardProps {
  initialLeads: Lead[]
}

export default function KanbanBoard({ initialLeads }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [convertLead, setConvertLead] = useState<Lead | null>(null)

  const leadsByStage = STAGES.reduce<Record<LeadStage, Lead[]>>(
    (acc, stage) => {
      acc[stage] = leads.filter((l) => l.stage === stage)
      return acc
    },
    {} as Record<LeadStage, Lead[]>
  )

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return
      const leadId = result.draggableId
      const newStage = result.destination.droppableId as LeadStage
      const oldStage = result.source.droppableId as LeadStage
      if (newStage === oldStage) return

      const movedLead = leads.find((l) => l.id === leadId)

      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
      )

      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (newStage === 'won' && movedLead) {
        setConvertLead({ ...movedLead, stage: 'won' })
      }
    },
    [leads]
  )

  const handleLeadAdded = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev])
    setIsAddModalOpen(false)
  }

  const handleLeadUpdated = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)))
    setEditLead(null)
    // If moved to won, offer conversion
    if (updatedLead.stage === 'won') {
      setConvertLead(updatedLead)
    }
  }

  const handleLeadDeleted = async (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId))
    await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
  }

  const handleCardEdit = (lead: Lead) => {
    if (lead.stage === 'won') {
      setConvertLead(lead)
    } else {
      setEditLead(lead)
    }
  }

  const activeCount = leads.filter(
    (l) => l.stage !== 'won' && l.stage !== 'lost'
  ).length

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">{activeCount} leads ativos</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />
          Novo Lead
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              leads={leadsByStage[stage]}
              onCardEdit={handleCardEdit}
              onCardDelete={handleLeadDeleted}
            />
          ))}
        </div>
      </DragDropContext>

      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onLeadAdded={handleLeadAdded}
      />

      <EditLeadModal
        lead={editLead}
        onClose={() => setEditLead(null)}
        onLeadUpdated={handleLeadUpdated}
      />

      {convertLead && (
        <ConvertToClientModal
          lead={convertLead}
          onClose={() => setConvertLead(null)}
          onConverted={() => {
            setLeads((prev) => prev.filter((l) => l.id !== convertLead.id))
            setConvertLead(null)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 5: Substituir `components/pipeline/KanbanColumn.tsx`**

```typescript
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
}

export default function KanbanColumn({ stage, leads, onCardEdit, onCardDelete }: KanbanColumnProps) {
  const totalValue = leads.reduce((sum, lead) => sum + lead.estimated_value, 0)

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`text-xs font-semibold uppercase tracking-wider ${STAGE_COLORS[stage]}`}>
            {STAGE_LABELS[stage]}
          </h3>
          <span className="text-slate-500 text-xs bg-slate-800 px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-slate-500 text-xs">{formatCurrency(totalValue)}</p>
        )}
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

- [ ] **Step 6: Commit**

```bash
git add components/pipeline/
git commit -m "feat: pipeline - edit lead modal, WhatsApp button, delete card, instagram/website fields"
```

---

## Task 4: Clientes — AddClientModal + ClientList

**Files:**
- Create: `components/clients/AddClientModal.tsx`
- Modify: `components/clients/ClientList.tsx`
- Modify: `app/(dashboard)/clients/page.tsx`

- [ ] **Step 1: Criar `components/clients/AddClientModal.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Client, ClientStatus } from '@/lib/types'

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onClientAdded: (client: Client) => void
}

export default function AddClientModal({ isOpen, onClose, onClientAdded }: AddClientModalProps) {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    monthly_value: '',
    status: 'active' as ClientStatus,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : 0,
        status: form.status,
      }),
    })

    if (!res.ok) {
      setError('Erro ao criar cliente. Tente novamente.')
      setLoading(false)
      return
    }

    const client = await res.json()
    onClientAdded(client)
    setForm({ name: '', company: '', email: '', phone: '', monthly_value: '', status: 'active' })
    setLoading(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Cliente">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nome *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome do contato"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Empresa</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => handleChange('company', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome da empresa"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="email@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Telefone / WhatsApp</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="(11) 99999-0000"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Mensalidade (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monthly_value}
              onChange={(e) => handleChange('monthly_value', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
        </div>
        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            {loading ? 'Criando...' : 'Criar Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Substituir `components/clients/ClientList.tsx`**

Adicionar estado local para clients (para suportar add optimista), botão "Novo Cliente" e `AddClientModal`:

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Client, ClientStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { Search, ChevronRight, Plus } from 'lucide-react'
import AddClientModal from './AddClientModal'

const STATUS_BADGE: Record<
  ClientStatus,
  { label: string; variant: 'green' | 'gray' | 'red' }
> = {
  active: { label: 'Ativo', variant: 'green' },
  inactive: { label: 'Inativo', variant: 'gray' },
  churned: { label: 'Churned', variant: 'red' },
}

interface ClientListProps {
  clients: Client[]
}

export default function ClientList({ clients: initialClients }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [search, setSearch] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function handleClientAdded(client: Client) {
    setClients((prev) => [client, ...prev])
    setIsAddModalOpen(false)
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente ou empresa..."
            className="w-full bg-[#1e293b] border border-slate-700 text-white rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus size={15} />
          Novo Cliente
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          </div>
        ) : (
          filtered.map((client) => {
            const badge = STATUS_BADGE[client.status]
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between bg-[#1e293b] hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 rounded-lg px-4 py-3 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 font-semibold text-sm flex-shrink-0">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{client.name}</p>
                    {client.company && (
                      <p className="text-slate-400 text-xs">{client.company}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {client.monthly_value > 0 && (
                    <span className="text-emerald-400 text-sm font-medium hidden sm:block">
                      {formatCurrency(client.monthly_value)}/mês
                    </span>
                  )}
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <ChevronRight
                    size={14}
                    className="text-slate-500 group-hover:text-slate-300 transition-colors"
                  />
                </div>
              </Link>
            )
          })
        )}
      </div>

      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onClientAdded={handleClientAdded}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/clients/AddClientModal.tsx components/clients/ClientList.tsx
git commit -m "feat: clientes - adicionar novo cliente com modal"
```

---

## Task 5: ClientFolder — Aba Dados + Pausar/Reativar/Remover

**Files:**
- Create: `components/clients/folder/DataTab.tsx`
- Modify: `components/clients/folder/ClientFolder.tsx`

- [ ] **Step 1: Criar `components/clients/folder/DataTab.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { Client } from '@/lib/types'
import { Instagram, Globe, MessageCircle, User } from 'lucide-react'

interface DataTabProps {
  client: Client
  onClientUpdated: (client: Client) => void
}

export default function DataTab({ client, onClientUpdated }: DataTabProps) {
  const [form, setForm] = useState({
    contact_name: client.contact_name ?? '',
    phone: client.phone ?? '',
    instagram: client.instagram ?? '',
    website: client.website ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: client.name,
        company: client.company,
        email: client.email,
        monthly_value: client.monthly_value,
        status: client.status,
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        instagram: form.instagram || null,
        website: form.website || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      onClientUpdated(updated)
      setSaved(true)
    }
    setSaving(false)
  }

  function cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '')
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
            <User size={12} /> Nome do Contato
          </label>
          <input
            type="text"
            value={form.contact_name}
            onChange={(e) => handleChange('contact_name', e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Nome do responsável na empresa"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
            <MessageCircle size={12} /> WhatsApp
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="flex-1 bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="(11) 99999-0000"
            />
            {form.phone && (
              <a
                href={`https://wa.me/55${cleanPhone(form.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2 bg-emerald-900/30 text-emerald-400 border border-emerald-800 rounded-lg text-xs hover:bg-emerald-900/50 transition-colors"
              >
                <MessageCircle size={12} />
                Abrir
              </a>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Instagram size={12} /> Instagram
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => handleChange('instagram', e.target.value)}
              className="flex-1 bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="@empresa"
            />
            {form.instagram && (
              <a
                href={`https://instagram.com/${form.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2 bg-indigo-900/30 text-indigo-400 border border-indigo-800 rounded-lg text-xs hover:bg-indigo-900/50 transition-colors"
              >
                <Instagram size={12} />
                Abrir
              </a>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Globe size={12} /> Website
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
              className="flex-1 bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="https://empresa.com.br"
            />
            {form.website && (
              <a
                href={form.website.startsWith('http') ? form.website : `https://${form.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2 bg-blue-900/30 text-blue-400 border border-blue-800 rounded-lg text-xs hover:bg-blue-900/50 transition-colors"
              >
                <Globe size={12} />
                Abrir
              </a>
            )}
          </div>
        </div>
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Substituir `components/clients/folder/ClientFolder.tsx`**

Adicionar aba Dados, botões Pausar/Reativar/Remover no header, estado local do client:

```typescript
'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { Client } from '@/lib/types'
import OnboardingTab from './OnboardingTab'
import ProjectsTab from './ProjectsTab'
import HistoryTab from './HistoryTab'
import TasksTab from './TasksTab'
import ProposalsTab from './ProposalsTab'
import FinancialTab from './FinancialTab'
import DataTab from './DataTab'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { Building2, DollarSign, Mail, Phone, Pause, Play, Trash2 } from 'lucide-react'

const TABS = [
  { id: 'data', label: '📊 Dados' },
  { id: 'onboarding', label: '📋 Onboarding' },
  { id: 'projects', label: '🚀 Projetos' },
  { id: 'proposals', label: '📄 Propostas' },
  { id: 'financial', label: '💰 Financeiro' },
  { id: 'history', label: '💬 Histórico' },
  { id: 'tasks', label: '✅ Tarefas' },
]

interface ClientFolderProps {
  client: Client
  activeTab: string
}

export default function ClientFolder({ client: initialClient, activeTab }: ClientFolderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [client, setClient] = useState<Client>(initialClient)

  function setTab(tab: string) {
    router.push(`${pathname}?tab=${tab}`)
  }

  async function handlePauseToggle() {
    const newStatus = client.status === 'active' ? 'inactive' : 'active'
    const label = newStatus === 'inactive' ? 'pausar' : 'reativar'
    if (!window.confirm(`Deseja ${label} este cliente?`)) return

    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.phone,
        monthly_value: client.monthly_value,
        status: newStatus,
        instagram: client.instagram,
        website: client.website,
        contact_name: client.contact_name,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setClient(updated)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remover o cliente "${client.name}"? Esta ação não pode ser desfeita.`)) return

    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/clients')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">{client.name}</h1>
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
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
            {client.monthly_value > 0 && (
              <span className="flex items-center gap-1.5 bg-emerald-900/20 text-emerald-400 border border-emerald-800 text-sm px-3 py-1 rounded-full">
                <DollarSign size={13} />
                {formatCurrency(client.monthly_value)}/mês
              </span>
            )}
            <Badge
              variant={
                client.status === 'active'
                  ? 'green'
                  : client.status === 'churned'
                  ? 'red'
                  : 'gray'
              }
            >
              {client.status === 'active'
                ? 'Ativo'
                : client.status === 'churned'
                ? 'Churned'
                : 'Inativo'}
            </Badge>
            <button
              onClick={handlePauseToggle}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-800 rounded-lg px-3 py-1.5 transition-colors"
              title={client.status === 'active' ? 'Pausar cliente' : 'Reativar cliente'}
            >
              {client.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
              {client.status === 'active' ? 'Pausar' : 'Reativar'}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800 rounded-lg px-3 py-1.5 transition-colors"
              title="Remover cliente"
            >
              <Trash2 size={12} />
              Remover
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-700 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-indigo-400 border-indigo-500 font-medium'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'data' && (
        <DataTab client={client} onClientUpdated={setClient} />
      )}
      {activeTab === 'onboarding' && <OnboardingTab clientId={client.id} />}
      {activeTab === 'projects' && <ProjectsTab clientId={client.id} />}
      {activeTab === 'proposals' && (
        <ProposalsTab clientId={client.id} clientName={client.name} />
      )}
      {activeTab === 'financial' && (
        <FinancialTab clientId={client.id} monthlyValue={client.monthly_value} />
      )}
      {activeTab === 'history' && <HistoryTab clientId={client.id} />}
      {activeTab === 'tasks' && <TasksTab clientId={client.id} />}
    </div>
  )
}
```

- [ ] **Step 3: Verificar que o activeTab default agora é 'data'**

No arquivo `app/(dashboard)/clients/[id]/page.tsx`, verificar se o searchParam default para a nova aba:

```typescript
// Localizar a linha com searchParams e alterar default para 'data':
const activeTab = searchParams.tab ?? 'data'
```

- [ ] **Step 4: Commit**

```bash
git add components/clients/folder/DataTab.tsx components/clients/folder/ClientFolder.tsx
git add "app/(dashboard)/clients/[id]/page.tsx"
git commit -m "feat: clientes - aba Dados, pausar/reativar, remover cliente"
```

---

## Task 6: ProjectsTab — Editar + Remover

**Files:**
- Modify: `components/clients/folder/ProjectsTab.tsx`

- [ ] **Step 1: Substituir `components/clients/folder/ProjectsTab.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { Project, ProjectStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'

const STATUS_BADGE: Record<
  ProjectStatus,
  { label: string; variant: 'blue' | 'green' | 'yellow' | 'gray' }
> = {
  in_progress: { label: 'Em andamento', variant: 'blue' },
  completed: { label: 'Concluído', variant: 'green' },
  paused: { label: 'Pausado', variant: 'yellow' },
  cancelled: { label: 'Cancelado', variant: 'gray' },
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluído' },
  { value: 'paused', label: 'Pausado' },
  { value: 'cancelled', label: 'Cancelado' },
]

interface ProjectsTabProps {
  clientId: string
}

export default function ProjectsTab({ clientId }: ProjectsTabProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'in_progress' as ProjectStatus,
  })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    status: 'in_progress' as ProjectStatus,
  })

  useEffect(() => {
    fetch(`/api/clients/${clientId}/projects`)
      .then((res) => res.json())
      .then((json) => {
        setProjects(json ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const project = await res.json()
      setProjects((prev) => [project, ...prev])
      setForm({ name: '', description: '', status: 'in_progress' })
      setShowForm(false)
    }
    setSaving(false)
  }

  function startEdit(project: Project) {
    setEditingId(project.id)
    setEditForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleEdit(projectId: string) {
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || null,
        status: editForm.status,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(projectId: string, name: string) {
    if (!window.confirm(`Remover o projeto "${name}"?`)) return
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    await fetch(`/api/clients/${clientId}/projects/${projectId}`, { method: 'DELETE' })
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-400 text-sm">{projects.length} projeto(s)</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          <Plus size={14} />
          Novo projeto
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-[#1e293b] border border-slate-700 rounded-lg p-4 mb-4 space-y-3"
        >
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Nome *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ex: Chatbot WhatsApp"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
            >
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {projects.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhum projeto cadastrado ainda.
          </div>
        ) : (
          projects.map((project) => {
            const badge = STATUS_BADGE[project.status]
            const isEditing = editingId === project.id

            if (isEditing) {
              return (
                <div key={project.id} className="bg-[#1e293b] border border-indigo-700 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Nome *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as ProjectStatus }))}
                      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex items-center gap-1 text-slate-400 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <X size={13} /> Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(project.id)}
                      disabled={saving}
                      className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium"
                    >
                      <Check size={13} /> {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={project.id} className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{project.name}</p>
                    {project.description && (
                      <p className="text-slate-400 text-xs mt-1">{project.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <button
                      onClick={() => startEdit(project)}
                      className="text-slate-600 hover:text-indigo-400 transition-colors"
                      title="Editar projeto"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(project.id, project.name)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Remover projeto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/clients/folder/ProjectsTab.tsx
git commit -m "feat: projetos - editar inline e remover"
```

---

## Task 7: FinancialTab — Editar Transação + Badge Atrasado

**Files:**
- Modify: `components/clients/folder/FinancialTab.tsx`

- [ ] **Step 1: Substituir `components/clients/folder/FinancialTab.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { Transaction, TransactionType } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pipeline'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'

const TYPE_BADGE: Record<TransactionType, { label: string; variant: 'green' | 'yellow' }> = {
  received: { label: 'Recebido', variant: 'green' },
  pending: { label: 'Pendente', variant: 'yellow' },
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR')
}

function isOverdue(dateStr: string, type: TransactionType): boolean {
  if (type !== 'pending') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return parseLocalDate(dateStr) < today
}

interface FinancialTabProps {
  clientId: string
  monthlyValue: number
}

export default function FinancialTab({ clientId, monthlyValue }: FinancialTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    type: 'received' as TransactionType,
    date: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    amount: '',
    type: 'received' as TransactionType,
    date: '',
    description: '',
  })

  useEffect(() => {
    fetch(`/api/transactions?client_id=${clientId}`)
      .then((r) => r.json())
      .then((json) => {
        setTransactions(json ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId])

  const totalReceived = transactions
    .filter((t) => t.type === 'received')
    .reduce((sum, t) => sum + (t.amount ?? 0), 0)

  const totalPending = transactions
    .filter((t) => t.type === 'pending')
    .reduce((sum, t) => sum + (t.amount ?? 0), 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        amount: parseFloat(form.amount),
        type: form.type,
        date: form.date || new Date().toISOString().split('T')[0],
        description: form.description || null,
      }),
    })
    if (!res.ok) {
      setSaving(false)
      return
    }
    const transaction = await res.json()
    setTransactions((prev) => [transaction, ...prev])
    setForm({ amount: '', type: 'received', date: '', description: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setEditForm({
      amount: String(t.amount),
      type: t.type,
      date: t.date,
      description: t.description ?? '',
    })
  }

  async function handleEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(editForm.amount),
        type: editForm.type,
        date: editForm.date,
        description: editForm.description || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)))
      setEditingId(null)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Mensalidade</p>
          <p className="text-white text-lg font-bold">{formatCurrency(monthlyValue)}</p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Recebido</p>
          <p className="text-emerald-400 text-lg font-bold">{formatCurrency(totalReceived)}</p>
        </div>
        <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Pendente</p>
          <p className="text-amber-400 text-lg font-bold">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <p className="text-slate-400 text-sm">{transactions.length} transação(ões)</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          <Plus size={14} />
          Registrar pagamento
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-[#1e293b] border border-slate-700 rounded-lg p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
              <input
                type="number" min="0" step="0.01" required
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="received">Recebido</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Ex: Mensalidade janeiro"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium">{saving ? 'Salvando...' : 'Registrar'}</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">Nenhuma transação registrada.</div>
        ) : (
          transactions.map((t) => {
            const badge = TYPE_BADGE[t.type]
            const overdue = isOverdue(t.date, t.type)
            const isEditing = editingId === t.id

            if (isEditing) {
              return (
                <div key={t.id} className="bg-[#1e293b] border border-indigo-700 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Valor *</label>
                      <input type="number" min="0" step="0.01" required value={editForm.amount}
                        onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Tipo</label>
                      <select value={editForm.type}
                        onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as TransactionType }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="received">Recebido</option>
                        <option value="pending">Pendente</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Data</label>
                      <input type="date" value={editForm.date}
                        onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                      <input type="text" value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="flex items-center gap-1 text-slate-400 border border-slate-700 rounded-lg px-3 py-2 text-sm"><X size={13} /> Cancelar</button>
                    <button type="button" onClick={() => handleEdit(t.id)} disabled={saving} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium"><Check size={13} /> {saving ? 'Salvando...' : 'Salvar'}</button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={t.id}
                className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-white text-sm font-medium">{formatCurrency(t.amount)}</p>
                  {t.description && (
                    <p className="text-slate-400 text-xs mt-0.5">{t.description}</p>
                  )}
                  <p className="text-slate-500 text-xs mt-0.5">{formatDate(t.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {overdue && (
                    <Badge variant="red">Atrasado</Badge>
                  )}
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <button
                    onClick={() => startEdit(t)}
                    className="text-slate-600 hover:text-indigo-400 transition-colors"
                    title="Editar transação"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/clients/folder/FinancialTab.tsx
git commit -m "feat: financeiro - editar transação inline e badge Atrasado"
```

---

## Task 8: HistoryTab — Remover Interação

**Files:**
- Modify: `components/clients/folder/HistoryTab.tsx`

- [ ] **Step 1: Adicionar botão delete em `components/clients/folder/HistoryTab.tsx`**

Adicionar import de `Trash2` e função `handleDelete`:

```typescript
// Adicionar ao import de lucide-react:
import { MessageSquare, Phone, Mail, Plus, Trash2 } from 'lucide-react'

// Adicionar função handleDelete dentro do componente (antes do return):
async function handleDelete(id: string) {
  if (!window.confirm('Remover esta interação?')) return
  setInteractions((prev) => prev.filter((i) => i.id !== id))
  await fetch(`/api/clients/${clientId}/interactions/${id}`, { method: 'DELETE' })
}
```

No JSX, dentro do map de `interactions`, adicionar o botão Trash2 no canto superior direito do card:

```typescript
// Dentro de <div className="flex-1 bg-[#1e293b] border border-slate-700 rounded-lg p-3">
// Na div que contém o tipo e data (flex items-center justify-between):
<div className="flex items-center justify-between mb-1">
  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
    {TYPE_LABELS[interaction.type]}
  </span>
  <div className="flex items-center gap-2">
    <span className="text-xs text-slate-500">
      {formatDate(interaction.happened_at)}
    </span>
    <button
      onClick={() => handleDelete(interaction.id)}
      className="text-slate-600 hover:text-red-400 transition-colors"
      title="Remover interação"
    >
      <Trash2 size={12} />
    </button>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add components/clients/folder/HistoryTab.tsx
git commit -m "feat: histórico - remover interação"
```

---

## Task 9: TasksTab — Editar + Remover Tarefa

**Files:**
- Modify: `components/clients/folder/TasksTab.tsx`

- [ ] **Step 1: Substituir `components/clients/folder/TasksTab.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { Task, TaskPriority, TaskStatus } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import { Trash2, Pencil, X, Check } from 'lucide-react'

const PRIORITY_BADGE: Record<
  TaskPriority,
  { label: string; variant: 'red' | 'yellow' | 'gray' }
> = {
  high: { label: 'Alta', variant: 'red' },
  medium: { label: 'Média', variant: 'yellow' },
  low: { label: 'Baixa', variant: 'gray' },
}

const STATUS_BADGE: Record<
  TaskStatus,
  { label: string; variant: 'gray' | 'blue' | 'green' }
> = {
  pending: { label: 'Pendente', variant: 'gray' },
  in_progress: { label: 'Em andamento', variant: 'blue' },
  done: { label: 'Concluída', variant: 'green' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
}

interface TasksTabProps {
  clientId: string
}

export default function TasksTab({ clientId }: TasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'pending' as TaskStatus,
    priority: 'medium' as TaskPriority,
    due_date: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/tasks?client_id=${clientId}`)
      .then((res) => res.json())
      .then((json) => {
        setTasks(json ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId])

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ?? '',
    })
  }

  async function handleEdit(taskId: string) {
    setSaving(true)
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title,
        description: editForm.description || null,
        status: editForm.status,
        priority: editForm.priority,
        due_date: editForm.due_date || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(taskId: string, title: string) {
    if (!window.confirm(`Remover a tarefa "${title}"?`)) return
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl">
      <p className="text-slate-400 text-sm mb-4">{tasks.length} tarefa(s) vinculada(s)</p>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhuma tarefa vinculada. Crie tarefas no módulo de Tarefas.
          </div>
        ) : (
          tasks.map((task) => {
            const priority = PRIORITY_BADGE[task.priority]
            const status = STATUS_BADGE[task.status]
            const isEditing = editingId === task.id

            if (isEditing) {
              return (
                <div key={task.id} className="bg-[#1e293b] border border-indigo-700 rounded-lg p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Título *</label>
                    <input type="text" required value={editForm.title}
                      onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Descrição</label>
                    <textarea value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Status</label>
                      <select value={editForm.status}
                        onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as TaskStatus }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em andamento</option>
                        <option value="done">Concluída</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Prioridade</label>
                      <select value={editForm.priority}
                        onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="high">Alta</option>
                        <option value="medium">Média</option>
                        <option value="low">Baixa</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Vencimento</label>
                      <input type="date" value={editForm.due_date}
                        onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))}
                        className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="flex items-center gap-1 text-slate-400 border border-slate-700 rounded-lg px-3 py-2 text-sm"><X size={13} /> Cancelar</button>
                    <button type="button" onClick={() => handleEdit(task.id)} disabled={saving} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium"><Check size={13} /> {saving ? 'Salvando...' : 'Salvar'}</button>
                  </div>
                </div>
              )
            }

            return (
              <div key={task.id} className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-slate-400 text-xs mt-1">{task.description}</p>
                    )}
                    {task.due_date && (
                      <p className="text-slate-500 text-xs mt-1">
                        Vence: {formatDate(task.due_date)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={priority.variant}>{priority.label}</Badge>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <button
                      onClick={() => startEdit(task)}
                      className="text-slate-600 hover:text-indigo-400 transition-colors"
                      title="Editar tarefa"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id, task.title)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Remover tarefa"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/clients/folder/TasksTab.tsx
git commit -m "feat: tarefas (cliente) - editar inline e remover"
```

---

## Task Final: Push + Verificação

- [ ] **Step 1: Push para GitHub/Vercel**

```bash
git push origin main
```

- [ ] **Step 2: Verificar deploy**

Acessar https://autocrm-olive.vercel.app e testar:
- Pipeline: clicar num card → modal de edição abre com campos preenchidos
- Pipeline: botão X → confirma e remove
- Pipeline: botão WhatsApp → abre wa.me em nova aba
- Clientes: botão "Novo Cliente" → modal cria cliente
- Clientes → aba Dados → salvar instagram/website
- Clientes → Pausar → status muda para Inativo
- Clientes → Projetos → lápis edita, trash remove
- Clientes → Financeiro → lápis edita transação, badge Atrasado em vermelho
- Clientes → Histórico → trash remove nota
- Clientes → Tarefas → lápis edita, trash remove
