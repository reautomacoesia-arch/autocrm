# Spec: Pacote 5 — Custom Fields

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase.

Sistema de campos personalizados usando padrão EAV (Entity-Attribute-Value). Campos de definição são globais por tipo de entidade — todos os clientes compartilham as mesmas definições, cada um com seus próprios valores.

---

## 1. Banco de Dados

### Tabela `custom_field_definitions`

```sql
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(10) NOT NULL CHECK (entity_type IN ('client', 'lead')),
  name VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox', 'url')),
  options JSONB NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `options`: só preenchido quando `field_type = 'select'`. Array JSON de strings: `["Opção A", "Opção B"]`.
- `sort_order`: ordem de exibição (inteiro, default 0).

### Tabela `custom_field_values`

```sql
CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  value TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(definition_id, entity_id)
);
```

- `value`: todos os tipos armazenados como texto. Conversão por `field_type`:
  - `checkbox`: `'true'` ou `'false'` (ou NULL = não respondido)
  - `number`: string numérica ex: `'42'` ou `'3.14'`
  - `date`: formato ISO `'2026-01-15'`
  - demais: string direta
- ON DELETE CASCADE: remover uma definição destrói automaticamente todos os valores correspondentes.

---

## 2. Tipos TypeScript (`lib/types.ts`)

```ts
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url'
export type CustomFieldEntityType = 'client' | 'lead'

export interface CustomFieldDefinition {
  id: string
  entity_type: CustomFieldEntityType
  name: string
  field_type: CustomFieldType
  options: string[] | null   // parsed from JSONB
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
```

---

## 3. API Routes

### `GET /api/custom-fields?entity_type=client`

Arquivo: `app/api/custom-fields/route.ts`

```ts
// Retorna todas as definições para o entity_type fornecido, ordenadas por sort_order
const { data } = await supabase
  .from('custom_field_definitions')
  .select('*')
  .eq('entity_type', entity_type)
  .order('sort_order', { ascending: true })
  .order('created_at', { ascending: true })
```

Resposta: array de `CustomFieldDefinition`.

### `POST /api/custom-fields`

Cria nova definição. Body: `{ entity_type, name, field_type, options? }`.

```ts
// sort_order = COUNT of existing defs for entity_type (append ao final)
const { count } = await supabase
  .from('custom_field_definitions')
  .select('*', { count: 'exact', head: true })
  .eq('entity_type', body.entity_type)

await supabase.from('custom_field_definitions').insert({
  entity_type: body.entity_type,
  name: body.name,
  field_type: body.field_type,
  options: body.options ?? null,
  sort_order: count ?? 0,
})
```

Resposta: o registro criado (status 201).

### `DELETE /api/custom-fields/[id]`

Arquivo: `app/api/custom-fields/[id]/route.ts`

Remove a definição. ON DELETE CASCADE destrói os valores automaticamente.

```ts
await supabase.from('custom_field_definitions').delete().eq('id', id)
```

Resposta: `{ success: true }` (status 200).

### `GET /api/custom-fields/values?entity_type=client&entity_id=xxx`

Arquivo: `app/api/custom-fields/values/route.ts`

Retorna valores do entity para o entity_type dado.

```ts
const { data } = await supabase
  .from('custom_field_values')
  .select('*')
  .eq('entity_id', entity_id)
  .in('definition_id', definitionIds) // ids das defs do entity_type
```

Na prática, o client component faz dois fetches sequenciais: primeiro GET definitions, depois GET values filtrando pelos IDs.

Alternativa mais simples (um único endpoint): retornar definições com seus valores para o entity_id embutidos:

```ts
// GET /api/custom-fields/values?entity_type=client&entity_id=xxx
// Retorna array de { definition: CustomFieldDefinition, value: string | null }
```

Implementação:
```ts
const { data: defs } = await supabase
  .from('custom_field_definitions')
  .select('*')
  .eq('entity_type', entity_type)
  .order('sort_order')

const { data: values } = await supabase
  .from('custom_field_values')
  .select('*')
  .eq('entity_id', entity_id)
  .in('definition_id', defs.map(d => d.id))

return defs.map(def => ({
  definition: def,
  value: values?.find(v => v.definition_id === def.id)?.value ?? null,
}))
```

### `PUT /api/custom-fields/values`

Arquivo: `app/api/custom-fields/values/route.ts` (método PUT)

Upsert em lote. Body: `{ entity_id: string, values: { definition_id: string, value: string | null }[] }`.

```ts
// Para cada item em values, upsert na tabela custom_field_values
for (const item of body.values) {
  if (item.value === null || item.value === '') {
    // remover valor existente (campo vazio = sem valor)
    await supabase.from('custom_field_values')
      .delete()
      .eq('definition_id', item.definition_id)
      .eq('entity_id', body.entity_id)
  } else {
    await supabase.from('custom_field_values')
      .upsert({
        definition_id: item.definition_id,
        entity_id: body.entity_id,
        value: item.value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'definition_id,entity_id' })
  }
}
```

Resposta: `{ success: true }`.

---

## 4. Componente `CustomFieldsTab`

### Arquivo
- **Criar:** `components/clients/folder/CustomFieldsTab.tsx`

### Props
```tsx
interface CustomFieldsTabProps {
  entityType: 'client' | 'lead'
  entityId: string
}
```

### Estado
```ts
definitions: FieldWithValue[]   // { definition: CustomFieldDefinition, value: string | null }
loading: boolean
saving: boolean
// form para nova definição
newField: { name: string; field_type: CustomFieldType; options: string }
// valores editáveis (mapa definition_id → value)
editValues: Record<string, string>
```

Onde `FieldWithValue = { definition: CustomFieldDefinition; value: string | null }`.

### Fetch
```ts
useEffect(() => {
  fetch(`/api/custom-fields/values?entity_type=${entityType}&entity_id=${entityId}`)
    .then(r => r.json())
    .then(data => {
      setDefinitions(data)
      const initialValues: Record<string, string> = {}
      for (const item of data) {
        initialValues[item.definition.id] = item.value ?? ''
      }
      setEditValues(initialValues)
      setLoading(false)
    })
}, [entityType, entityId])
```

### handleAddDefinition
```ts
async function handleAddDefinition(e: React.FormEvent) {
  e.preventDefault()
  const options = newField.field_type === 'select'
    ? newField.options.split(',').map(s => s.trim()).filter(Boolean)
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
    const created = await res.json()
    setDefinitions(prev => [...prev, { definition: created, value: null }])
    setEditValues(prev => ({ ...prev, [created.id]: '' }))
    setNewField({ name: '', field_type: 'text', options: '' })
    toast('Campo adicionado')
  }
}
```

### handleDeleteDefinition
```ts
async function handleDeleteDefinition(defId: string) {
  const ok = await confirm({
    title: 'Remover este campo?',
    description: 'Os valores preenchidos em todos os registros serão apagados permanentemente.',
    destructive: true,
    confirmLabel: 'Remover',
  })
  if (!ok) return
  await fetch(`/api/custom-fields/${defId}`, { method: 'DELETE' })
  setDefinitions(prev => prev.filter(f => f.definition.id !== defId))
  setEditValues(prev => {
    const next = { ...prev }
    delete next[defId]
    return next
  })
  toast('Campo removido')
}
```

### handleSaveValues
```ts
async function handleSaveValues(e: React.FormEvent) {
  e.preventDefault()
  setSaving(true)
  const values = Object.entries(editValues).map(([definition_id, value]) => ({
    definition_id,
    value: value || null,
  }))
  await fetch('/api/custom-fields/values', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: entityId, values }),
  })
  setSaving(false)
  toast('Campos salvos')
}
```

### Renderização de input por tipo

```tsx
function renderInput(def: CustomFieldDefinition, value: string, onChange: (v: string) => void) {
  const cls = "w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
  switch (def.field_type) {
    case 'text':
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} />
    case 'number':
      return <input type="number" value={value} onChange={e => onChange(e.target.value)} className={cls} />
    case 'date':
      return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={cls} />
    case 'url':
      return <input type="url" value={value} onChange={e => onChange(e.target.value)} className={cls} placeholder="https://" />
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={e => onChange(e.target.checked ? 'true' : 'false')}
          className="w-4 h-4 accent-indigo-500"
        />
      )
    case 'select':
      return (
        <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
          <option value="">Selecionar...</option>
          {(def.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    default:
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} />
  }
}
```

### JSX estrutura

```tsx
return (
  <div className="max-w-2xl space-y-6">
    {/* Seção 1: Gerenciar definições */}
    <div>
      <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        Gerenciar campos
      </h2>
      {/* Lista de definições existentes */}
      <div className="space-y-2 mb-4">
        {definitions.map(({ definition: def }) => (
          <div key={def.id} className="flex items-center justify-between bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-2.5">
            <div>
              <span className="text-white text-sm">{def.name}</span>
              <span className="ml-2 text-slate-500 text-xs">{def.field_type}</span>
            </div>
            <button onClick={() => handleDeleteDefinition(def.id)} className="text-slate-600 hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {definitions.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-4">Nenhum campo personalizado ainda.</p>
        )}
      </div>
      {/* Form para adicionar campo */}
      <form onSubmit={handleAddDefinition} className="flex gap-2 flex-wrap">
        <input
          type="text"
          required
          value={newField.name}
          onChange={e => setNewField(p => ({ ...p, name: e.target.value }))}
          placeholder="Nome do campo *"
          className="flex-1 min-w-[140px] bg-[#1e293b] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
        <select
          value={newField.field_type}
          onChange={e => setNewField(p => ({ ...p, field_type: e.target.value as CustomFieldType }))}
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
          <input
            type="text"
            value={newField.options}
            onChange={e => setNewField(p => ({ ...p, options: e.target.value }))}
            placeholder="Opções: A, B, C"
            className="flex-1 min-w-[140px] bg-[#1e293b] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        )}
        <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
          + Adicionar
        </button>
      </form>
    </div>

    {/* Seção 2: Valores deste registro */}
    {definitions.length > 0 && (
      <form onSubmit={handleSaveValues}>
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Valores
        </h2>
        <div className="space-y-4 mb-4">
          {definitions.map(({ definition: def }) => (
            <div key={def.id}>
              <label className="block text-xs text-slate-400 mb-1.5">{def.name}</label>
              {renderInput(def, editValues[def.id] ?? '', v =>
                setEditValues(prev => ({ ...prev, [def.id]: v }))
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
```

---

## 5. ClientFolder — nova aba "Campos"

### Arquivo
- **Modificar:** `components/clients/folder/ClientFolder.tsx`

Adicionar ao array `TABS`:
```tsx
{ id: 'custom', label: '⚙️ Campos', countKey: null, greenIfPositive: false },
```

Adicionar ao bloco de conteúdo:
```tsx
{activeTab === 'custom' && (
  <CustomFieldsTab entityType="client" entityId={client.id} />
)}
```

Import: `import CustomFieldsTab from './CustomFieldsTab'`

---

## 6. KanbanCard — seção "Campos extras" no modo edição

### Arquivo
- **Modificar:** `components/pipeline/KanbanCard.tsx`

No inline edit form (modo P8), adicionar uma seção colapsável após os campos existentes (name/company/estimated_value/phone/source/next_step), antes dos botões Cancelar/Salvar:

```tsx
const [showCustomFields, setShowCustomFields] = useState(false)
const [leadCustomFields, setLeadCustomFields] = useState<FieldWithValue[]>([])
const [customValues, setCustomValues] = useState<Record<string, string>>({})
const [savingCustom, setSavingCustom] = useState(false)

// Fetch quando o card entra em modo edição
useEffect(() => {
  if (!isEditing) return
  fetch(`/api/custom-fields/values?entity_type=lead&entity_id=${lead.id}`)
    .then(r => r.json())
    .then(data => {
      setLeadCustomFields(data)
      const vals: Record<string, string> = {}
      for (const item of data) {
        vals[item.definition.id] = item.value ?? ''
      }
      setCustomValues(vals)
    })
}, [isEditing, lead.id])
```

JSX no form (antes dos botões):
```tsx
{leadCustomFields.length > 0 && (
  <div className="mb-2">
    <button
      type="button"
      onClick={() => setShowCustomFields(p => !p)}
      className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors w-full text-left py-1"
    >
      <ChevronRight size={12} className={`transition-transform ${showCustomFields ? 'rotate-90' : ''}`} />
      Campos extras ({leadCustomFields.length})
    </button>
    {showCustomFields && (
      <div className="mt-2 space-y-2 pl-1">
        {leadCustomFields.map(({ definition: def }) => (
          <div key={def.id}>
            <label className="block text-[10px] text-slate-500 mb-0.5">{def.name}</label>
            {renderInputKanban(def, customValues[def.id] ?? '', v =>
              setCustomValues(prev => ({ ...prev, [def.id]: v }))
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

Função `renderInputKanban` — versão compacta do `renderInput` com estilo menor (xs, bg-[#1e293b]).

Função `handleSaveCustomFields`:
```ts
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

---

## Regras técnicas

- Ambas as tabelas precisam de migration via Supabase MCP
- `options` é armazenado como JSONB array no DB mas retornado como `string[]` já parseado pelo Supabase
- Upsert usa `onConflict: 'definition_id,entity_id'` — a constraint UNIQUE já existe
- Campos do tipo `checkbox` com value null = não respondido (não exibir como "false")
- KanbanCard só faz o fetch de custom fields quando `isEditing === true` (lazy load)
- `CustomFieldsTab` é 'use client' e faz seus próprios fetches

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| Supabase DB | Migration — 2 novas tabelas |
| `lib/types.ts` | Criar tipos: CustomFieldDefinition, CustomFieldValue, CustomFieldType |
| `app/api/custom-fields/route.ts` | Criar — GET + POST |
| `app/api/custom-fields/[id]/route.ts` | Criar — DELETE |
| `app/api/custom-fields/values/route.ts` | Criar — GET + PUT |
| `components/clients/folder/CustomFieldsTab.tsx` | Criar — componente completo |
| `components/clients/folder/ClientFolder.tsx` | Modificar — adicionar tab "Campos" |
| `components/pipeline/KanbanCard.tsx` | Modificar — seção "Campos extras" no edit form |
