# Spec: Pacote 4 — Dados Extras

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase.

**Dois grupos técnicos distintos:**
- **P9+P10** — requerem migração de banco (novos campos na tabela `leads`) + update de API + UI
- **F4+F5+F8** — cálculos sobre dados já existentes, sem migration

---

## 1. P9 — Origem do Lead (`source`)

### Migration
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(50) NULL;
```

### Tipos TypeScript (`lib/types.ts`)
Adicionar ao `interface Lead`:
```ts
source: string | null
```

Valores válidos (não enforced no DB, apenas na UI): `'instagram'` · `'indicacao'` · `'site'` · `'linkedin'` · `'whatsapp'` · `'outro'`

Label para exibição:
```ts
export const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  indicacao: 'Indicação',
  site: 'Site',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  outro: 'Outro',
}
```

### API — `app/api/leads/route.ts` (POST)
Adicionar ao insert:
```ts
source: body.source ?? null,
```

### API — `app/api/leads/[id]/route.ts` (PATCH)
Adicionar ao update:
```ts
source: body.source ?? null,
```

### UI — `components/pipeline/KanbanCard.tsx`
**View mode:** Se `lead.source` preenchido, exibir chip no rodapé do card:
```tsx
{lead.source && (
  <div className="mt-2 flex items-center gap-1">
    <span className="text-[10px] bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded-full">
      📥 {SOURCE_LABELS[lead.source] ?? lead.source}
    </span>
  </div>
)}
```

**Edit form (inline, P8):** Adicionar select de origem após o campo de telefone:
```tsx
<select
  value={editForm.source}
  onChange={(e) => setEditForm((p) => ({ ...p, source: e.target.value }))}
  className="col-span-2 bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
>
  <option value="">Origem...</option>
  <option value="instagram">Instagram</option>
  <option value="indicacao">Indicação</option>
  <option value="site">Site</option>
  <option value="linkedin">LinkedIn</option>
  <option value="whatsapp">WhatsApp</option>
  <option value="outro">Outro</option>
</select>
```

O `editForm` em KanbanCard também deve incluir `source: lead.source ?? ''`.

O `handleSave` deve incluir `source: editForm.source || null` no body do PATCH.

### UI — `components/pipeline/AddLeadModal.tsx`
Adicionar select de origem ao form, após o campo Observações:
```tsx
<div>
  <label className="block text-xs text-slate-400 mb-1.5">Origem</label>
  <select
    value={form.source}
    onChange={(e) => handleChange('source', e.target.value)}
    className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
  >
    <option value="">Selecionar origem...</option>
    <option value="instagram">Instagram</option>
    <option value="indicacao">Indicação</option>
    <option value="site">Site</option>
    <option value="linkedin">LinkedIn</option>
    <option value="whatsapp">WhatsApp</option>
    <option value="outro">Outro</option>
  </select>
</div>
```

O state `form` deve incluir `source: ''` e o POST body deve incluir `source: form.source || null`.

---

## 2. P10 — Próximo Passo (`next_step`)

### Migration
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_step TEXT NULL;
```

### Tipos TypeScript (`lib/types.ts`)
Adicionar ao `interface Lead`:
```ts
next_step: string | null
```

### API — `app/api/leads/route.ts` (POST)
```ts
next_step: body.next_step ?? null,
```

### API — `app/api/leads/[id]/route.ts` (PATCH)
```ts
next_step: body.next_step ?? null,
```

### UI — `components/pipeline/KanbanCard.tsx`
**View mode:** Se `lead.next_step` preenchido, exibir bloco âmbar abaixo do valor:
```tsx
{lead.next_step && (
  <div className="mt-2 border-l-2 border-amber-500 pl-2 bg-amber-950/20 rounded-r py-1">
    <p className="text-amber-400 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Próximo passo</p>
    <p className="text-amber-100 text-xs leading-tight">{lead.next_step}</p>
  </div>
)}
```

**Edit form (inline, P8):** Adicionar input de próximo passo após o select de origem:
```tsx
<input
  value={editForm.next_step}
  onChange={(e) => setEditForm((p) => ({ ...p, next_step: e.target.value }))}
  className="col-span-2 bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
  placeholder="Próximo passo..."
/>
```

O `editForm` deve incluir `next_step: lead.next_step ?? ''`.
O `handleSave` deve incluir `next_step: editForm.next_step || null`.

### UI — `components/pipeline/AddLeadModal.tsx`
Adicionar após o select de origem:
```tsx
<div>
  <label className="block text-xs text-slate-400 mb-1.5">Próximo passo</label>
  <input
    type="text"
    value={form.next_step}
    onChange={(e) => handleChange('next_step', e.target.value)}
    className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
    placeholder="Ex: Enviar proposta até sexta..."
  />
</div>
```

O state `form` deve incluir `next_step: ''` e o POST body deve incluir `next_step: form.next_step || null`.

---

## 3. F4 — Tempo de Casa

### Arquivo
- **Modificar:** `components/clients/folder/ClientFolder.tsx`

### Helper function (fora do componente)
```ts
function tenureLabel(started_at: string | null): string | null {
  if (!started_at) return null
  const months = Math.floor(
    (Date.now() - new Date(started_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  )
  if (months < 1) return 'menos de 1 mês'
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem === 0
    ? `${years} ${years === 1 ? 'ano' : 'anos'}`
    : `${years}a ${rem}m`
}
```

### UI
No header de ClientFolder, após o badge de MRR, adicionar:
```tsx
{tenureLabel(client.started_at) && (
  <span className="flex items-center gap-1 text-slate-400 text-xs">
    🏠 {tenureLabel(client.started_at)}
  </span>
)}
```

Posição: dentro do `<div className="flex items-center gap-3 flex-shrink-0">` que já contém MRR e os botões de ação.

---

## 4. F5 — LTV (Lifetime Value)

### Arquivo
- **Modificar:** `components/clients/folder/FinancialTab.tsx`

### Lógica
O LTV é calculado sobre **todas** as transações (array `transactions`, não `filteredTransactions`):

```ts
const ltv = transactions
  .filter((t) => t.type === 'received')
  .reduce((sum, t) => sum + t.amount, 0)
```

### UI
Adicionar como 4º card de resumo, ao final dos 3 cards existentes (MRR, Recebido, Pendente):

```tsx
<div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
  <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">LTV Total</p>
  <p className="text-emerald-400 text-lg font-bold">{formatCurrency(ltv)}</p>
  <p className="text-slate-500 text-xs mt-1">total histórico recebido</p>
</div>
```

O grid de 3 cards passa para 4 colunas: `grid-cols-4`.

---

## 5. F8 — Progresso do Onboarding

### Arquivo
- **Modificar:** `components/clients/folder/OnboardingTab.tsx`

### Lógica
O array `FIELDS` já tem 6 entradas. Contar campos preenchidos a partir do estado `data`:

```ts
const filledCount = FIELDS.filter((f) => {
  const val = data[f.key]
  return val !== null && val !== undefined && String(val).trim() !== ''
}).length
const pct = Math.round((filledCount / FIELDS.length) * 100)
```

### UI
Adicionar barra de progresso no topo do formulário, antes do primeiro campo:

```tsx
{/* Progresso */}
<div className="mb-4 p-3 bg-[#1e293b] border border-slate-700 rounded-lg">
  <div className="flex items-center justify-between mb-2">
    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
      Progresso do Onboarding
    </span>
    <span className={`text-xs font-bold ${
      pct === 100 ? 'text-emerald-400' : pct >= 50 ? 'text-indigo-400' : 'text-amber-400'
    }`}>
      {pct}%
    </span>
  </div>
  <div className="bg-slate-800 rounded-full h-1.5 overflow-hidden">
    <div
      className={`h-full rounded-full transition-all ${
        pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'
      }`}
      style={{ width: `${pct}%` }}
    />
  </div>
  <p className="text-slate-500 text-xs mt-1">{filledCount} de {FIELDS.length} campos preenchidos</p>
</div>
```

Cores: 0-49% âmbar, 50-99% índigo, 100% verde.

---

## Regras técnicas

- Migration P9+P10: usar `ALTER TABLE leads ADD COLUMN IF NOT EXISTS` (idempotente)
- `SOURCE_LABELS` exportado de `lib/types.ts` (ou de `lib/pipeline.ts` — onde fizer mais sentido)
- KanbanCard `editForm` e `handleSave` devem ser atualizados para incluir `source` e `next_step`
- F4 `tenureLabel` retorna `null` se `started_at` for null — o componente não renderiza nada nesse caso
- F5 LTV usa `transactions` (array completo), não `filteredTransactions` (que é afetado pelos filtros FN1)
- F8 considera campo preenchido se não null, não undefined, e não string vazia após trim
