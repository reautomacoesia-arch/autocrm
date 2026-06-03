# Pacote 4 — Dados Extras: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 5 campos de dados extras ao AutoCRM: origem e próximo passo no lead (com migration), tempo de casa, LTV e progresso de onboarding do cliente (sem migration).

**Architecture:** P9+P10 exigem migration Supabase + update de tipos TypeScript + update de API + UI. F4/F5/F8 são cálculos puros sobre dados já existentes — só alterações de UI/componentes. Tasks 1-3 devem ser executadas nessa ordem (migration → tipos/API → UI). Tasks 4-6 são independentes entre si.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase (MCP tools disponíveis)

> **Nota:** Sem suite de testes. Padrão: Implementar → Verificar no browser → Commit.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| Supabase DB (`leads` table) | Migration — `source VARCHAR(50)` + `next_step TEXT` |
| `lib/types.ts` | Modificar — Lead interface + SOURCE_LABELS |
| `app/api/leads/route.ts` | Modificar — POST inclui source + next_step |
| `app/api/leads/[id]/route.ts` | Modificar — PATCH inclui source + next_step |
| `components/pipeline/KanbanCard.tsx` | Modificar — chips P9+P10 na view, campos no edit form |
| `components/pipeline/AddLeadModal.tsx` | Modificar — campos source + next_step |
| `components/clients/folder/ClientFolder.tsx` | Modificar — F4 tempo de casa |
| `components/clients/folder/FinancialTab.tsx` | Modificar — F5 LTV card |
| `components/clients/folder/OnboardingTab.tsx` | Modificar — F8 barra de progresso |

---

### Task 1: DB Migration — source + next_step na tabela leads

**Files:**
- Supabase database (via MCP)

**Contexto:** A tabela `leads` no Supabase precisa de 2 novas colunas. Use o Supabase MCP disponível (`mcp__9e8ef12e-af68-422f-a0dc-bdb409a0b8ee__*`).

- [ ] **Step 1: Descobrir o project_id do Supabase**

Usar a ferramenta `mcp__9e8ef12e-af68-422f-a0dc-bdb409a0b8ee__list_projects` para listar os projetos e obter o `id` do projeto AutoCRM.

- [ ] **Step 2: Executar a migration**

Usar `mcp__9e8ef12e-af68-422f-a0dc-bdb409a0b8ee__execute_sql` com o project_id obtido no step anterior e o SQL:

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(50) NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_step TEXT NULL;
```

- [ ] **Step 3: Verificar as colunas**

Usar `execute_sql` para confirmar:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name IN ('source', 'next_step');
```

Expected: 2 linhas — `source` (character varying, YES) e `next_step` (text, YES).

- [ ] **Step 4: Commit (apenas nota de migration)**

```bash
git commit --allow-empty -m "chore: apply Supabase migration — leads.source + leads.next_step"
```

---

### Task 2: Tipos TypeScript + API

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/api/leads/route.ts`
- Modify: `app/api/leads/[id]/route.ts`

**Contexto:** Após a migration, o TypeScript precisa conhecer os novos campos, e as APIs precisam enviá-los/recebê-los.

- [ ] **Step 1: Atualizar `lib/types.ts`**

Adicionar ao `interface Lead` (após a linha `website: string | null`):
```ts
source: string | null
next_step: string | null
```

Adicionar após o `interface Lead`, como export:
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

- [ ] **Step 2: Atualizar `app/api/leads/route.ts` (POST)**

No bloco `.insert({...})`, adicionar após `notes: body.notes ?? null`:
```ts
source: body.source ?? null,
next_step: body.next_step ?? null,
```

- [ ] **Step 3: Atualizar `app/api/leads/[id]/route.ts` (PATCH)**

No bloco `.update({...})`, adicionar após `website: body.website ?? null`:
```ts
source: body.source ?? null,
next_step: body.next_step ?? null,
```

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts app/api/leads/route.ts app/api/leads/[id]/route.ts
git commit -m "feat: add source and next_step fields to Lead type and API (P9+P10)"
```

---

### Task 3: P9+P10 — KanbanCard e AddLeadModal

**Files:**
- Modify: `components/pipeline/KanbanCard.tsx`
- Modify: `components/pipeline/AddLeadModal.tsx`

**Contexto:** KanbanCard foi modificado no Pacote 3 (P8) — agora tem inline edit com 4 campos (name, company, estimated_value, phone) e chips de exibição. Precisamos adicionar `source` e `next_step` tanto no form quanto na view. AddLeadModal é o modal para criar novos leads.

- [ ] **Step 1: Ler ambos os arquivos para entender o estado atual**

Ler `components/pipeline/KanbanCard.tsx` e `components/pipeline/AddLeadModal.tsx` antes de editar.

- [ ] **Step 2: Atualizar `KanbanCard.tsx` — import SOURCE_LABELS**

Adicionar ao import de `@/lib/types`:
```tsx
import type { Lead } from '@/lib/types'
import { SOURCE_LABELS } from '@/lib/types'
```

- [ ] **Step 3: Atualizar `KanbanCard.tsx` — editForm inclui novos campos**

Localizar onde `editForm` é definido no useState e onde é reinicializado no `handleCardClick`. Adicionar `source` e `next_step`:

Estado inicial (no useState):
```tsx
const [editForm, setEditForm] = useState({
  name: lead.name,
  company: lead.company ?? '',
  estimated_value: String(lead.estimated_value),
  phone: lead.phone ?? '',
  source: lead.source ?? '',
  next_step: lead.next_step ?? '',
})
```

No `handleCardClick` (reinicialização):
```tsx
setEditForm({
  name: lead.name,
  company: lead.company ?? '',
  estimated_value: String(lead.estimated_value),
  phone: lead.phone ?? '',
  source: lead.source ?? '',
  next_step: lead.next_step ?? '',
})
```

- [ ] **Step 4: Atualizar `KanbanCard.tsx` — handleSave inclui novos campos**

No body do PATCH (dentro de `handleSave`), adicionar após `website: lead.website`:
```tsx
source: editForm.source || null,
next_step: editForm.next_step || null,
```

- [ ] **Step 5: Atualizar `KanbanCard.tsx` — campos no edit form**

No JSX do form (modo edição), após o grid de `estimated_value` e `phone`, adicionar antes dos botões Cancelar/Salvar:

```tsx
<select
  value={editForm.source}
  onChange={(e) => setEditForm((p) => ({ ...p, source: e.target.value }))}
  className="bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
>
  <option value="">Origem...</option>
  <option value="instagram">Instagram</option>
  <option value="indicacao">Indicação</option>
  <option value="site">Site</option>
  <option value="linkedin">LinkedIn</option>
  <option value="whatsapp">WhatsApp</option>
  <option value="outro">Outro</option>
</select>
<input
  value={editForm.next_step}
  onChange={(e) => setEditForm((p) => ({ ...p, next_step: e.target.value }))}
  className="bg-[#1e293b] border border-slate-600 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
  placeholder="Próximo passo..."
/>
```

Nota: o select e o input ficam em linha separada do grid 2 colunas existente. Adicionar `className` de `col-span-2` se necessário para ocupar largura total.

- [ ] **Step 6: Atualizar `KanbanCard.tsx` — chips na view mode**

No JSX da view (modo leitura), após o bloco do WhatsApp button, adicionar os chips de source e next_step:

```tsx
{lead.source && (
  <div className="mt-2">
    <span className="text-[10px] bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded-full">
      📥 {SOURCE_LABELS[lead.source] ?? lead.source}
    </span>
  </div>
)}
{lead.next_step && (
  <div className="mt-2 border-l-2 border-amber-500 pl-2 bg-amber-950/20 rounded-r py-1">
    <p className="text-amber-400 text-[10px] font-semibold uppercase tracking-wide mb-0.5">Próximo passo</p>
    <p className="text-amber-100 text-xs leading-tight">{lead.next_step}</p>
  </div>
)}
```

- [ ] **Step 7: Atualizar `AddLeadModal.tsx`**

7a. Adicionar `source: ''` e `next_step: ''` ao estado `form` inicial:
```tsx
const [form, setForm] = useState({
  name: '',
  company: '',
  email: '',
  phone: '',
  estimated_value: '',
  instagram: '',
  website: '',
  notes: '',
  source: '',
  next_step: '',
})
```

7b. Adicionar ao `setForm` no reset (após `onLeadAdded(lead)`):
```tsx
setForm({ name: '', company: '', email: '', phone: '', estimated_value: '', instagram: '', website: '', notes: '', source: '', next_step: '' })
```

7c. Adicionar ao body do POST (após `notes: form.notes || null`):
```tsx
source: form.source || null,
next_step: form.next_step || null,
```

7d. Adicionar no JSX do form, após o campo Observações (antes dos botões Cancelar/Criar Lead):

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="block text-xs text-slate-400 mb-1.5">Origem</label>
    <select
      value={form.source}
      onChange={(e) => handleChange('source', e.target.value)}
      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
    >
      <option value="">Selecionar...</option>
      <option value="instagram">Instagram</option>
      <option value="indicacao">Indicação</option>
      <option value="site">Site</option>
      <option value="linkedin">LinkedIn</option>
      <option value="whatsapp">WhatsApp</option>
      <option value="outro">Outro</option>
    </select>
  </div>
  <div>
    <label className="block text-xs text-slate-400 mb-1.5">Próximo passo</label>
    <input
      type="text"
      value={form.next_step}
      onChange={(e) => handleChange('next_step', e.target.value)}
      className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
      placeholder="Ex: Enviar proposta..."
    />
  </div>
</div>
```

- [ ] **Step 8: Verificar no browser**

Abrir Pipeline. Testar:
- Criar novo lead: campos Origem e Próximo Passo aparecem no modal
- Card criado com origem mostra chip roxo "📥 Instagram"
- Card com próximo passo mostra bloco âmbar
- Editar card inline: selects e input de próximo passo aparecem
- Salvar → dados persistem no reload

- [ ] **Step 9: Commit**

```bash
git add components/pipeline/KanbanCard.tsx components/pipeline/AddLeadModal.tsx
git commit -m "feat: add source chip and next_step callout to KanbanCard + AddLeadModal (P9+P10)"
```

---

### Task 4: F4 — Tempo de Casa no ClientFolder

**Files:**
- Modify: `components/clients/folder/ClientFolder.tsx`

**Contexto:** `client.started_at` já existe (nullable string ISO). Calcular quanto tempo o cliente está na empresa e exibir no header. Sem migration, sem nova query.

- [ ] **Step 1: Adicionar helper `tenureLabel` antes do componente**

No arquivo `ClientFolder.tsx`, antes do `export default function ClientFolder`, adicionar:

```tsx
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

- [ ] **Step 2: Exibir tempo de casa no header**

No JSX do header, dentro da `<div className="flex items-center gap-3 flex-shrink-0">` que contém os badges de MRR e status (lado direito do header), adicionar após o badge de MRR e antes do Badge de status:

```tsx
{tenureLabel(client.started_at) && (
  <span className="flex items-center gap-1 text-slate-400 text-xs">
    🏠 {tenureLabel(client.started_at)}
  </span>
)}
```

- [ ] **Step 3: Verificar no browser**

Abrir pasta de um cliente que tem `started_at` preenchido. O header deve mostrar "🏠 2a 3m" (ou o valor correspondente) entre o MRR e o badge de status. Clientes sem `started_at` não mostram nada.

- [ ] **Step 4: Commit**

```bash
git add components/clients/folder/ClientFolder.tsx
git commit -m "feat: show client tenure in folder header (F4)"
```

---

### Task 5: F5 — LTV na FinancialTab

**Files:**
- Modify: `components/clients/folder/FinancialTab.tsx`

**Contexto:** FinancialTab.tsx já tem summary cards (MRR, Recebido, Pendente) e um array `transactions` não-filtrado. Após o Pacote 2 (FN1), existe também `filteredTransactions`. O LTV usa o array `transactions` completo.

- [ ] **Step 1: Computar LTV**

Ler o arquivo para localizar onde `totalReceived` e `totalPending` são calculados. Após essas variáveis (e depois da lógica de `filteredTransactions`), adicionar:

```tsx
// F5 — LTV: total histórico recebido (todos os transactions, não filtrados)
const ltv = transactions
  .filter((t) => t.type === 'received')
  .reduce((sum, t) => sum + t.amount, 0)
```

- [ ] **Step 2: Adicionar o 4º card de resumo**

Localizar o grid de summary cards. Atualmente tem 3 cards (`grid-cols-3`). Mudar para `grid-cols-4` e adicionar o 4º card após os 3 existentes:

```tsx
{/* Grid header: mudar className de grid-cols-3 para grid-cols-4 */}
<div className="grid grid-cols-4 gap-3 mb-4">
  {/* ... 3 cards existentes (MRR, Recebido, Pendente) ... */}
  <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-4">
    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">LTV Total</p>
    <p className="text-emerald-400 text-lg font-bold">{formatCurrency(ltv)}</p>
    <p className="text-slate-500 text-xs mt-1">total histórico recebido</p>
  </div>
</div>
```

- [ ] **Step 3: Verificar no browser**

Abrir pasta de um cliente → aba Financeiro. Deve aparecer 4 cards: MRR, Recebido (filtrado), Pendente (filtrado), LTV Total (soma histórica de tudo recebido). Quando filtros FN1 estão ativos, os primeiros 3 mudam mas LTV Total permanece fixo.

- [ ] **Step 4: Commit**

```bash
git add components/clients/folder/FinancialTab.tsx
git commit -m "feat: add LTV total card to FinancialTab (F5)"
```

---

### Task 6: F8 — Progresso do Onboarding

**Files:**
- Modify: `components/clients/folder/OnboardingTab.tsx`

**Contexto:** OnboardingTab tem 6 campos definidos no array `FIELDS` (segment, team_size, current_tools, main_pain, accesses, notes). O estado `data` contém os valores atuais. F8 adiciona uma barra de progresso que conta quantos campos estão preenchidos.

- [ ] **Step 1: Calcular progresso**

No componente `OnboardingTab`, após a declaração dos estados (`data`, `loading`, `saving`, `saved`), adicionar:

```tsx
const filledCount = FIELDS.filter((f) => {
  const val = data[f.key]
  return val !== null && val !== undefined && String(val).trim() !== ''
}).length
const pct = Math.round((filledCount / FIELDS.length) * 100)
```

- [ ] **Step 2: Adicionar barra de progresso no JSX**

No `return (...)`, dentro do `<form>`, adicionar o seguinte ANTES do `{FIELDS.map(...)}`:

```tsx
{/* F8 — Progresso do Onboarding */}
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
  <p className="text-slate-500 text-xs mt-1">
    {filledCount} de {FIELDS.length} campos preenchidos
  </p>
</div>
```

- [ ] **Step 3: Verificar no browser**

Abrir pasta de um cliente → aba Onboarding. A barra de progresso deve aparecer acima dos campos. Com 0 campos: 0% âmbar. Com 3/6: 50% índigo. Com 6/6: 100% verde. Preencher um campo e salvar → percentual atualiza na próxima abertura (pois o estado é carregado do servidor).

- [ ] **Step 4: Commit**

```bash
git add components/clients/folder/OnboardingTab.tsx
git commit -m "feat: add onboarding progress bar to OnboardingTab (F8)"
```

---

## Checklist de spec coverage

- [x] P9: `source VARCHAR(50) NULL` na tabela leads — Task 1
- [x] P9: `Lead.source: string | null` + `SOURCE_LABELS` exportado — Task 2
- [x] P9: PATCH e POST de leads incluem source — Task 2
- [x] P9: Chip roxo no KanbanCard view — Task 3
- [x] P9: Select de origem no KanbanCard inline form — Task 3
- [x] P9: Select de origem no AddLeadModal — Task 3
- [x] P10: `next_step TEXT NULL` na tabela leads — Task 1
- [x] P10: `Lead.next_step: string | null` — Task 2
- [x] P10: PATCH e POST de leads incluem next_step — Task 2
- [x] P10: Bloco âmbar no KanbanCard view — Task 3
- [x] P10: Input de próximo passo no KanbanCard inline form — Task 3
- [x] P10: Input de próximo passo no AddLeadModal — Task 3
- [x] F4: `tenureLabel` helper — Task 4
- [x] F4: Exibição no header de ClientFolder — Task 4
- [x] F5: LTV computado de `transactions` (não filtrado) — Task 5
- [x] F5: 4º card de resumo na FinancialTab — Task 5
- [x] F8: Progresso calculado dos 6 campos de FIELDS — Task 6
- [x] F8: Barra de progresso com cores (âmbar/índigo/verde) — Task 6
