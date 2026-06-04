# Pacote 5 — Custom Fields: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema completo de campos personalizados (EAV) para clientes e leads no AutoCRM.

**Architecture:** Padrão EAV com duas tabelas Supabase (`custom_field_definitions` + `custom_field_values`), 3 rotas de API, um novo componente `CustomFieldsTab` usado na aba "Campos" do ClientFolder, e uma seção colapsável no modo de edição inline do KanbanCard.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase (MCP tools para migration)

> **Nota:** Sem suite de testes. Padrão: Implementar → Verificar no browser → Commit. Tasks 1–7 devem ser executadas **em ordem** — cada uma depende da anterior.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| Supabase DB | Migration — 2 novas tabelas |
| `lib/types.ts` | Modificar — novos tipos CF |
| `app/api/custom-fields/route.ts` | Criar — GET + POST |
| `app/api/custom-fields/[id]/route.ts` | Criar — DELETE |
| `app/api/custom-fields/values/route.ts` | Criar — GET + PUT |
| `components/clients/folder/CustomFieldsTab.tsx` | Criar — componente principal |
| `components/clients/folder/ClientFolder.tsx` | Modificar — nova aba Campos |
| `components/pipeline/KanbanCard.tsx` | Modificar — seção Campos extras |

---

### Task 1: DB Migration — Criar tabelas custom_field_definitions e custom_field_values

**Files:**
- Supabase database (via MCP)

**Contexto:** Usar o Supabase MCP disponível. O projeto já foi restaurado numa sessão anterior — as tabelas da migration inicial já existem.

- [ ] **Step 1: Descobrir o project_id**

Usar `mcp__9e8ef12e-af68-422f-a0dc-bdb409a0b8ee__list_projects` para obter o ID do projeto AutoCRM.

- [ ] **Step 2: Criar as tabelas**

Usar `mcp__9e8ef12e-af68-422f-a0dc-bdb409a0b8ee__execute_sql` com:

```sql
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(10) NOT NULL CHECK (entity_type IN ('client', 'lead')),
  name VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox', 'url')),
  options JSONB NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  value TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(definition_id, entity_id)
);
```

- [ ] **Step 3: Verificar as tabelas**

Usar `execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('custom_field_definitions', 'custom_field_values');
```

Expected: 2 linhas.

- [ ] **Step 4: Commit (marker)**

```bash
cd "C:\Users\Natalia Silva\Documents\02. Renan\4 CLAUDE\1 Projeto Inicial\autocrm"
git commit --allow-empty -m "chore: create custom_field_definitions + custom_field_values tables"
```

---

### Task 2: Tipos TypeScript

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Adicionar tipos ao `lib/types.ts`**

Após o último `interface` existente (Interaction), adicionar:

```ts
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url'
export type CustomFieldEntityType = 'client' | 'lead'

export interface CustomFieldDefinition {
  id: string
  entity_type: CustomFieldEntityType
  name: string
  field_type: CustomFieldType
  options: string[] | null
  sort_order: number
  created_at: string
}

export interface CustomFieldValue {
  id: string
  definition_id: string
  entity_id: string
  value: string | null
  created_at: string
  updated_at: string
}

export interface FieldWithValue {
  definition: CustomFieldDefinition
  value: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add CustomFieldDefinition, CustomFieldValue, FieldWithValue types"
```

---

### Task 3: API — Definições (GET + POST + DELETE)

**Files:**
- Create: `app/api/custom-fields/route.ts`
- Create: `app/api/custom-fields/[id]/route.ts`

- [ ] **Step 1: Criar `app/api/custom-fields/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const entity_type = searchParams.get('entity_type')
  if (!entity_type) {
    return NextResponse.json({ error: 'entity_type required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('entity_type', entity_type)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  // Calcular sort_order como contagem de campos existentes do mesmo entity_type
  const { count } = await supabase
    .from('custom_field_definitions')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', body.entity_type)

  const { data, error } = await supabase
    .from('custom_field_definitions')
    .insert({
      entity_type: body.entity_type,
      name: body.name,
      field_type: body.field_type,
      options: body.options ?? null,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Criar `app/api/custom-fields/[id]/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('custom_field_definitions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/custom-fields/route.ts app/api/custom-fields/[id]/route.ts
git commit -m "feat: add custom-fields API — GET, POST, DELETE definitions"
```

---

### Task 4: API — Valores (GET + PUT)

**Files:**
- Create: `app/api/custom-fields/values/route.ts`

- [ ] **Step 1: Criar `app/api/custom-fields/values/route.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { FieldWithValue } from '@/lib/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const entity_type = searchParams.get('entity_type')
  const entity_id = searchParams.get('entity_id')

  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Buscar definições do entity_type
  const { data: defs, error: defsError } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('entity_type', entity_type)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (defsError) return NextResponse.json({ error: defsError.message }, { status: 500 })
  if (!defs || defs.length === 0) return NextResponse.json([])

  // Buscar valores para este entity_id
  const { data: values, error: valuesError } = await supabase
    .from('custom_field_values')
    .select('*')
    .eq('entity_id', entity_id)
    .in('definition_id', defs.map((d) => d.id))

  if (valuesError) return NextResponse.json({ error: valuesError.message }, { status: 500 })

  // Combinar: definição + valor correspondente
  const result: FieldWithValue[] = defs.map((def) => ({
    definition: def,
    value: values?.find((v) => v.definition_id === def.id)?.value ?? null,
  }))

  return NextResponse.json(result)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  // body: { entity_id: string, values: { definition_id: string, value: string | null }[] }

  const { entity_id, values } = body

  if (!entity_id || !Array.isArray(values)) {
    return NextResponse.json({ error: 'entity_id and values required' }, { status: 400 })
  }

  for (const item of values) {
    if (item.value === null || item.value === '') {
      // Remover valor existente (campo vazio = sem valor)
      await supabase
        .from('custom_field_values')
        .delete()
        .eq('definition_id', item.definition_id)
        .eq('entity_id', entity_id)
    } else {
      // Upsert — inserir ou atualizar
      await supabase.from('custom_field_values').upsert(
        {
          definition_id: item.definition_id,
          entity_id,
          value: item.value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'definition_id,entity_id' }
      )
    }
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/custom-fields/values/route.ts
git commit -m "feat: add custom-fields values API — GET combined + PUT upsert"
```

---

### Task 5: CustomFieldsTab Component

**Files:**
- Create: `components/clients/folder/CustomFieldsTab.tsx`

**Contexto:** Componente Client Component completo com duas seções: gerenciar definições de campo (global) e preencher valores do registro atual. Usa `useToast` e `useConfirm` já disponíveis via Providers.

- [ ] **Step 1: Criar `components/clients/folder/CustomFieldsTab.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import type { CustomFieldDefinition, CustomFieldType, FieldWithValue } from '@/lib/types'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface CustomFieldsTabProps {
  entityType: 'client' | 'lead'
  entityId: string
}

function renderInput(
  def: CustomFieldDefinition,
  value: string,
  onChange: (v: string) => void,
  cls: string
) {
  switch (def.field_type) {
    case 'number':
      return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
    case 'date':
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
    case 'url':
      return <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://" className={cls} />
    case 'checkbox':
      return (
        <div className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-slate-400 text-sm">{value === 'true' ? 'Sim' : 'Não'}</span>
        </div>
      )
    case 'select':
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">Selecionar...</option>
          {(def.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    default: // text
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
  }
}

export default function CustomFieldsTab({ entityType, entityId }: CustomFieldsTabProps) {
  const { toast } = useToast()
  const confirm = useConfirm()

  const [fields, setFields] = useState<FieldWithValue[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  // Novo campo form
  const [newField, setNewField] = useState<{
    name: string
    field_type: CustomFieldType
    options: string
  }>({ name: '', field_type: 'text', options: '' })
  const [addSaving, setAddSaving] = useState(false)

  const inputCls = 'w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500'

  useEffect(() => {
    fetch(`/api/custom-fields/values?entity_type=${entityType}&entity_id=${entityId}`)
      .then((r) => r.json())
      .then((data: FieldWithValue[]) => {
        setFields(data)
        const vals: Record<string, string> = {}
        for (const item of data) {
          vals[item.definition.id] = item.value ?? ''
        }
        setEditValues(vals)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [entityType, entityId])

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    const options =
      newField.field_type === 'select'
        ? newField.options.split(',').map((s) => s.trim()).filter(Boolean)
        : null
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: entityType,
        name: newField.name,
        field_type: newField.field_type,
        options,
      }),
    })
    if (res.ok) {
      const created: CustomFieldDefinition = await res.json()
      setFields((prev) => [...prev, { definition: created, value: null }])
      setEditValues((prev) => ({ ...prev, [created.id]: '' }))
      setNewField({ name: '', field_type: 'text', options: '' })
      toast('Campo adicionado')
    } else {
      toast('Erro ao adicionar campo', 'error')
    }
    setAddSaving(false)
  }

  async function handleDeleteField(defId: string, defName: string) {
    const ok = await confirm({
      title: `Remover campo "${defName}"?`,
      description: 'Os valores preenchidos em todos os registros serão apagados permanentemente.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    await fetch(`/api/custom-fields/${defId}`, { method: 'DELETE' })
    setFields((prev) => prev.filter((f) => f.definition.id !== defId))
    setEditValues((prev) => {
      const next = { ...prev }
      delete next[defId]
      return next
    })
    toast('Campo removido')
  }

  async function handleSaveValues(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const values = Object.entries(editValues).map(([definition_id, value]) => ({
      definition_id,
      value: value || null,
    }))
    const res = await fetch('/api/custom-fields/values', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: entityId, values }),
    })
    if (res.ok) {
      toast('Campos salvos')
    } else {
      toast('Erro ao salvar campos', 'error')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center">Carregando...</div>
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Seção 1: Gerenciar definições */}
      <div>
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Gerenciar campos
        </h2>

        <div className="space-y-2 mb-4">
          {fields.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">
              Nenhum campo personalizado ainda.
            </p>
          ) : (
            fields.map(({ definition: def }) => (
              <div
                key={def.id}
                className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm">{def.name}</span>
                  <span className="text-slate-600 text-xs bg-slate-800 px-2 py-0.5 rounded">
                    {def.field_type}
                  </span>
                  {def.options && (
                    <span className="text-slate-600 text-xs">
                      ({def.options.join(', ')})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteField(def.id, def.name)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                  title="Remover campo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Form novo campo */}
        <form onSubmit={handleAddField} className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[140px]">
            <input
              type="text"
              required
              value={newField.name}
              onChange={(e) => setNewField((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nome do campo *"
              className="w-full bg-[#1e293b] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={newField.field_type}
            onChange={(e) =>
              setNewField((p) => ({ ...p, field_type: e.target.value as CustomFieldType }))
            }
            className="bg-[#1e293b] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Data</option>
            <option value="select">Seleção</option>
            <option value="checkbox">Checkbox</option>
            <option value="url">URL</option>
          </select>
          {newField.field_type === 'select' && (
            <div className="flex-1 min-w-[140px]">
              <input
                type="text"
                value={newField.options}
                onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                placeholder="Opções: A, B, C"
                className="w-full bg-[#1e293b] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={addSaving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
          >
            {addSaving ? '...' : '+ Adicionar'}
          </button>
        </form>
      </div>

      {/* Seção 2: Valores */}
      {fields.length > 0 && (
        <form onSubmit={handleSaveValues}>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Valores
          </h2>
          <div className="space-y-4 mb-4">
            {fields.map(({ definition: def }) => (
              <div key={def.id}>
                <label className="block text-xs text-slate-400 mb-1.5">{def.name}</label>
                {renderInput(
                  def,
                  editValues[def.id] ?? '',
                  (v) => setEditValues((prev) => ({ ...prev, [def.id]: v })),
                  inputCls
                )}
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar campos'}
          </button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/clients/folder/CustomFieldsTab.tsx
git commit -m "feat: add CustomFieldsTab component with field management + values"
```

---

### Task 6: ClientFolder — Nova aba Campos

**Files:**
- Modify: `components/clients/folder/ClientFolder.tsx`

**Contexto:** ClientFolder tem um array `TABS` com `{ id, label, countKey, greenIfPositive }`. As abas são renderizadas dinamicamente. Adicionar aba "⚙️ Campos" e o bloco de conteúdo correspondente.

- [ ] **Step 1: Adicionar import**

Localizar os imports no topo de `ClientFolder.tsx`. Adicionar:
```tsx
import CustomFieldsTab from './CustomFieldsTab'
```

- [ ] **Step 2: Adicionar aba ao array TABS**

No array `TABS`, adicionar como último item:
```tsx
{ id: 'custom',    label: '⚙️ Campos',    countKey: null,            greenIfPositive: false },
```

- [ ] **Step 3: Adicionar bloco de conteúdo**

No bloco de renderização de conteúdo (onde as tabs são exibidas condicionalmente), adicionar após o último bloco existente:
```tsx
{activeTab === 'custom' && (
  <CustomFieldsTab entityType="client" entityId={client.id} />
)}
```

- [ ] **Step 4: Verificar no browser**

Abrir pasta de um cliente. A aba "⚙️ Campos" deve aparecer. Clicar nela mostra o CustomFieldsTab com a seção de gerenciar campos e um form para adicionar.

- [ ] **Step 5: Commit**

```bash
git add components/clients/folder/ClientFolder.tsx
git commit -m "feat: add Campos tab to ClientFolder (CF — client custom fields)"
```

---

### Task 7: KanbanCard — Seção "Campos extras" no modo de edição

**Files:**
- Modify: `components/pipeline/KanbanCard.tsx`

**Contexto:** KanbanCard foi modificado em Pacote 3 (P8) para ter edição inline. O modo de edição tem um `<form>` com campos de nome/empresa/valor/telefone/source/next_step + botões Cancelar/Salvar. Adicionar uma seção colapsável de campos customizados do lead ANTES dos botões.

- [ ] **Step 1: Ler `components/pipeline/KanbanCard.tsx` completo**

Entender a estrutura atual do form de edição inline antes de modificar.

- [ ] **Step 2: Adicionar imports**

Adicionar ao import de lucide-react `ChevronRight` (se não já estiver). Adicionar:
```tsx
import type { FieldWithValue } from '@/lib/types'
```

- [ ] **Step 3: Adicionar estado para campos extras**

Dentro do componente, após os estados existentes (`isEditing`, `editForm`, `saving`), adicionar:

```tsx
const [showCustomFields, setShowCustomFields] = useState(false)
const [leadCustomFields, setLeadCustomFields] = useState<FieldWithValue[]>([])
const [customValues, setCustomValues] = useState<Record<string, string>>({})
const [savingCustom, setSavingCustom] = useState(false)
```

- [ ] **Step 4: Fetch de campos quando card entra em modo edição**

Após os handlers existentes (handleDelete, handleWhatsApp, handleCardClick, handleSave), adicionar:

```tsx
useEffect(() => {
  if (!isEditing) return
  fetch(`/api/custom-fields/values?entity_type=lead&entity_id=${lead.id}`)
    .then((r) => r.json())
    .then((data: FieldWithValue[]) => {
      setLeadCustomFields(data)
      const vals: Record<string, string> = {}
      for (const item of data) {
        vals[item.definition.id] = item.value ?? ''
      }
      setCustomValues(vals)
    })
    .catch(() => {})
}, [isEditing, lead.id])
```

Adicionar `useEffect` ao import do React (já está — verificar se useEffect já está importado).

- [ ] **Step 5: Adicionar `handleSaveCustomFields`**

Após o useEffect acima, adicionar:

```tsx
async function handleSaveCustomFields() {
  setSavingCustom(true)
  const values = Object.entries(customValues).map(([definition_id, value]) => ({
    definition_id,
    value: value || null,
  }))
  await fetch('/api/custom-fields/values', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: lead.id, values }),
  })
  setSavingCustom(false)
}
```

- [ ] **Step 6: Adicionar `renderInputKanban` helper**

Antes do `return` do componente, adicionar a função helper compact para inputs no card:

```tsx
function renderInputKanban(
  def: import('@/lib/types').CustomFieldDefinition,
  value: string,
  onChange: (v: string) => void
) {
  const cls = 'w-full bg-[#0f172a] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500'
  switch (def.field_type) {
    case 'number':
      return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
    case 'date':
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
    case 'url':
      return <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://" className={cls} />
    case 'checkbox':
      return (
        <div className="flex items-center gap-1.5 py-0.5">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            className="w-3 h-3 accent-indigo-500"
          />
          <span className="text-slate-500 text-[10px]">{value === 'true' ? 'Sim' : 'Não'}</span>
        </div>
      )
    case 'select':
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">Selecionar...</option>
          {(def.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    default:
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
  }
}
```

- [ ] **Step 7: Adicionar seção colapsável no form JSX**

No form de edição inline, ANTES dos botões `<div className="flex gap-1.5">` (Cancelar/Salvar), adicionar:

```tsx
{leadCustomFields.length > 0 && (
  <div className="mb-2">
    <button
      type="button"
      onClick={() => setShowCustomFields((p) => !p)}
      className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors w-full text-left py-1"
    >
      <ChevronRight
        size={11}
        className={`transition-transform flex-shrink-0 ${showCustomFields ? 'rotate-90' : ''}`}
      />
      Campos extras ({leadCustomFields.length})
    </button>
    {showCustomFields && (
      <div className="mt-1.5 space-y-2 pl-1">
        {leadCustomFields.map(({ definition: def }) => (
          <div key={def.id}>
            <p className="text-[10px] text-slate-500 mb-0.5">{def.name}</p>
            {renderInputKanban(
              def,
              customValues[def.id] ?? '',
              (v) => setCustomValues((prev) => ({ ...prev, [def.id]: v }))
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleSaveCustomFields}
          disabled={savingCustom}
          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-3 py-1 transition-colors disabled:opacity-50"
        >
          {savingCustom ? '...' : 'Salvar extras'}
        </button>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 8: Verificar no browser**

Abrir Pipeline. Criar um campo personalizado para lead pela aba "⚙️ Campos" em qualquer cliente (nops — campos de lead não aparecem lá). 

**Para testar**: 
1. Primeiro criar uma definição de campo para `entity_type=lead` via API diretamente ou adicionando um botão de teste
2. Clicar num card não-won para editar inline
3. A seção "Campos extras (N)" deve aparecer antes dos botões
4. Expandir e preencher → clicar "Salvar extras"

**Nota:** Para criar campos de lead, o usuário precisa usar a aba "⚙️ Campos" em algum cliente — mas essa aba está configurada como `entityType="client"`. Para criar campos de *lead*, é necessário uma forma diferente.

**Correção**: O CustomFieldsTab renderizado no ClientFolder usa `entityType="client"`. Não há UI para criar campos de lead na pasta do cliente. 

Para resolver isso sem adicionar complexidade: adicionar um link/botão no card do Kanban expandido que leva para criação de campo de lead. Alternativamente, deixar a criação de campos de lead também no CustomFieldsTab, mas com parâmetro diferente.

**Decisão de design**: O KanbanCard em modo edição, quando `leadCustomFields.length === 0`, mostrar uma mensagem/link:

```tsx
{leadCustomFields.length === 0 && isEditing && (
  <p className="text-slate-600 text-[10px] mb-2">
    Nenhum campo extra configurado para leads.
  </p>
)}
```

E adicionar uma rota de gestão de campos de lead: criar um segundo `CustomFieldsTab` em `app/(dashboard)/pipeline/page.tsx` ou em qualquer page adequada. **Mais simples:** adicionar a gestão de campos de lead dentro do próprio KanbanCard expandido como uma seção separada quando `leadCustomFields.length === 0` mostra um botão "Gerenciar campos de lead" que abre um modal.

**Solução pragmática:** Criar um modal `ManageLeadFieldsModal` chamado pelo KanbanBoard (não pelo KanbanCard) — ou simplesmente usar o mesmo `CustomFieldsTab` num modal separado. Para manter o escopo, implementar a gestão de campos de lead em um modal básico invocado do KanbanBoard.

**Implementação simplificada para Task 7:** O KanbanCard mostra os campos se existirem. A gestão (create/delete) de definições de campos de lead fica num botão "⚙️ Campos de leads" que o KanbanBoard mostra na barra de título. O KanbanBoard já tem o botão "Novo Lead" — adicionar um segundo botão.

Modificar `components/pipeline/KanbanBoard.tsx` para adicionar um botão/modal de gestão de campos de lead:

```tsx
// No header do KanbanBoard, após o botão "Novo Lead"
<button
  onClick={() => setIsLeadFieldsOpen(true)}
  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 text-sm px-3 py-2 rounded-lg transition-colors"
>
  ⚙️ Campos
</button>
```

E um modal simples usando `<Modal>` que renderiza `<CustomFieldsTab entityType="lead" entityId="__manage__" />`.

**Mas:** `CustomFieldsTab` faz fetch de valores para um `entityId` específico. Para a gestão de definições, podemos passar um `entityId` fictício (ex: `'__manage__'`) que nunca vai ter valores reais, e mostrar só a seção de gerenciar. Ou refatorar o componente.

**Solução final mais limpa para o plano:** Criar um componente separado `ManageCustomFieldsModal.tsx` que só faz a gestão de definições (sem a seção de valores). Chamado pelo KanbanBoard.

- [ ] **Step 9: Commit**

```bash
git add components/pipeline/KanbanCard.tsx
git commit -m "feat: add custom fields section to KanbanCard inline edit"
```

---

### Task 8: ManageLeadFieldsModal + KanbanBoard integration

**Files:**
- Create: `components/pipeline/ManageLeadFieldsModal.tsx`
- Modify: `components/pipeline/KanbanBoard.tsx`

**Contexto:** Para criar/gerenciar definições de campos de lead, precisamos de um modal chamado do KanbanBoard. O `CustomFieldsTab` mostra valores de um entity específico + gerencia definições — não serve aqui. Criar um modal focado em gestão de definições.

- [ ] **Step 1: Criar `components/pipeline/ManageLeadFieldsModal.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import type { CustomFieldDefinition, CustomFieldType } from '@/lib/types'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

interface ManageLeadFieldsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ManageLeadFieldsModal({ isOpen, onClose }: ManageLeadFieldsModalProps) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [defs, setDefs] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [newField, setNewField] = useState<{ name: string; field_type: CustomFieldType; options: string }>(
    { name: '', field_type: 'text', options: '' }
  )
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/custom-fields?entity_type=lead')
      .then((r) => r.json())
      .then((data) => { setDefs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isOpen])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    const options =
      newField.field_type === 'select'
        ? newField.options.split(',').map((s) => s.trim()).filter(Boolean)
        : null
    const res = await fetch('/api/custom-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'lead', name: newField.name, field_type: newField.field_type, options }),
    })
    if (res.ok) {
      const created = await res.json()
      setDefs((prev) => [...prev, created])
      setNewField({ name: '', field_type: 'text', options: '' })
      toast('Campo adicionado')
    }
    setAddSaving(false)
  }

  async function handleDelete(def: CustomFieldDefinition) {
    const ok = await confirm({
      title: `Remover campo "${def.name}"?`,
      description: 'Os valores de todos os leads serão apagados permanentemente.',
      destructive: true,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    await fetch(`/api/custom-fields/${def.id}`, { method: 'DELETE' })
    setDefs((prev) => prev.filter((d) => d.id !== def.id))
    toast('Campo removido')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1e293b] border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-base font-semibold">Campos de leads</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm text-center py-4">Carregando...</p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {defs.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">Nenhum campo ainda.</p>
              ) : (
                defs.map((def) => (
                  <div key={def.id} className="flex items-center justify-between bg-[#0f172a] border border-slate-700 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm">{def.name}</span>
                      <span className="text-slate-600 text-xs bg-slate-800 px-2 py-0.5 rounded">{def.field_type}</span>
                    </div>
                    <button onClick={() => handleDelete(def)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
              <input
                type="text"
                required
                value={newField.name}
                onChange={(e) => setNewField((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome do campo *"
                className="flex-1 min-w-[120px] bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <select
                value={newField.field_type}
                onChange={(e) => setNewField((p) => ({ ...p, field_type: e.target.value as CustomFieldType }))}
                className="bg-[#0f172a] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="text">Texto</option>
                <option value="number">Número</option>
                <option value="date">Data</option>
                <option value="select">Seleção</option>
                <option value="checkbox">Checkbox</option>
                <option value="url">URL</option>
              </select>
              {newField.field_type === 'select' && (
                <input
                  type="text"
                  value={newField.options}
                  onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                  placeholder="A, B, C"
                  className="flex-1 min-w-[100px] bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              )}
              <button
                type="submit"
                disabled={addSaving}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
              >
                {addSaving ? '...' : '+ Adicionar'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modificar `KanbanBoard.tsx` — adicionar botão + modal**

Adicionar `isLeadFieldsOpen` state e o botão "⚙️ Campos":

```tsx
const [isLeadFieldsOpen, setIsLeadFieldsOpen] = useState(false)
```

No header (ao lado do botão "Novo Lead"):
```tsx
<button
  onClick={() => setIsLeadFieldsOpen(true)}
  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 text-sm px-3 py-2 rounded-lg transition-colors"
>
  ⚙️ Campos
</button>
```

Adicionar o modal antes do `</>` final:
```tsx
<ManageLeadFieldsModal
  isOpen={isLeadFieldsOpen}
  onClose={() => setIsLeadFieldsOpen(false)}
/>
```

Import: `import ManageLeadFieldsModal from './ManageLeadFieldsModal'`

- [ ] **Step 3: Verificar no browser**

1. Abrir Pipeline → clicar "⚙️ Campos" → modal abre, mostra lista de campos de lead
2. Adicionar um campo "Setor" (texto) → aparece na lista
3. Fechar modal → clicar num card para editar inline → seção "Campos extras (1)" aparece
4. Expandir, preencher "Tecnologia" → clicar "Salvar extras" → valor persiste

- [ ] **Step 4: Commit**

```bash
git add components/pipeline/ManageLeadFieldsModal.tsx components/pipeline/KanbanBoard.tsx
git commit -m "feat: add ManageLeadFieldsModal + ⚙️ Campos button to KanbanBoard"
```

---

## Checklist de spec coverage

- [x] DB: `custom_field_definitions` table — Task 1
- [x] DB: `custom_field_values` table com UNIQUE(definition_id, entity_id) — Task 1
- [x] Tipos TypeScript: CustomFieldDefinition, CustomFieldValue, FieldWithValue — Task 2
- [x] API GET /api/custom-fields — Task 3
- [x] API POST /api/custom-fields — Task 3
- [x] API DELETE /api/custom-fields/[id] — Task 3
- [x] API GET /api/custom-fields/values — Task 4
- [x] API PUT /api/custom-fields/values (upsert + delete when empty) — Task 4
- [x] CustomFieldsTab: gestão de definições (add/delete) — Task 5
- [x] CustomFieldsTab: renderização de todos os 6 tipos de input — Task 5
- [x] CustomFieldsTab: seção de valores com salvar — Task 5
- [x] ClientFolder: aba "⚙️ Campos" — Task 6
- [x] KanbanCard: seção "Campos extras" colapsável — Task 7
- [x] KanbanCard: fetch lazy (só quando isEditing) — Task 7
- [x] ManageLeadFieldsModal: gestão de definições para leads — Task 8
- [x] KanbanBoard: botão "⚙️ Campos" → ManageLeadFieldsModal — Task 8
