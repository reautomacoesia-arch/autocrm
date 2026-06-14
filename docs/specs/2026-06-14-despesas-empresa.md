# Despesas da empresa (com recorrência) — Korvus CRM

> Spec aprovado em 2026-06-14. Implementação delegada a agente Sonnet.
> Adiciona registro de despesas/gastos da empresa (avulsas e recorrentes mensais geradas por cron) + Lucro nos Relatórios.

## Dependência externa (NÃO é tarefa do agente)
A migration `supabase/migrations/026_expenses.sql` JÁ EXISTE (não recriar). Usuário aplica manual. Cria a tabela `expenses` (description, amount, category, date, recurring, recurring_day, recurring_key, parent_id) com RLS authenticated, unique index em recurring_key, index em date. Código deve compilar mesmo antes de aplicar; erros de runtime tratados.

## Modelo (espelha a recorrência de clientes em 008_recurring_billing / cron seção 5)
- Despesa AVULSA: `recurring=false`, com `date`. Conta nos totais.
- Despesa RECORRENTE = um "template": `recurring=true` + `recurring_day` (1-31). NÃO conta nos totais (é só definição). O cron gera 1 instância concreta por mês a partir dela.
- Instância gerada: `recurring=false`, `parent_id`=template, `recurring_key`=`expense:{templateId}:{YYYY-MM}`, `date`=`{YYYY-MM}-{dia}`. Conta nos totais.
- REGRA DE TOTAIS (em todo lugar — Financeiro e Relatórios): somar apenas `expenses` com `recurring=false`. Nunca somar templates (recurring=true) p/ não duplicar.

## 1. Tipos (`lib/types.ts`)
```ts
export interface Expense {
  id: string
  description: string
  amount: number
  category: string | null
  date: string
  recurring: boolean
  recurring_day: number | null
  recurring_key: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
}
```
Categorias sugeridas (constante exportável p/ o select): Aluguel, Salários, Ferramentas/Software, Impostos, Marketing, Serviços, Pró-labore, Outros.

## 2. Schemas (`lib/api/schemas.ts`)
- `expenseCreateSchema`: description text(300).min(1); amount z.number().finite(); category optText(100); date dateStr; recurring z.boolean().optional(); recurring_day z.number().int().min(1).max(31).nullish().
- `expenseUpdateSchema = expenseCreateSchema.partial()`.
- Usar os helpers existentes (text, optText, dateStr, money/number) seguindo o padrão do arquivo.

## 3. API
- `app/api/expenses/route.ts`: GET (lista, ordenar por date desc; aceitar querystring opcional `?recurring=true|false` e `?month=YYYY-MM` p/ filtrar) e POST (cria via expenseCreateSchema). createClient (sessão/RLS).
- `app/api/expenses/[id]/route.ts`: PATCH (expenseUpdateSchema) e DELETE. createClient.

## 4. Cron (`app/api/cron/route.ts`) — gerar instâncias recorrentes
Logo após a seção 5 (recorrência de clientes), adicionar seção análoga para expenses, usando o MESMO `todayDay`/`currentMonth` já calculados:
```
const { data: recurringExpenses } = await supabase.from('expenses')
  .select('id, description, amount, category, recurring_day')
  .eq('recurring', true).not('recurring_day','is', null)
for (const exp of recurringExpenses ?? []) {
  const day = exp.recurring_day as number
  if (todayDay < day) continue
  const key = `expense:${exp.id}:${currentMonth}`
  const { data: existing } = await supabase.from('expenses').select('id').eq('recurring_key', key).maybeSingle()
  if (existing) continue
  const date = `${currentMonth}-${String(day).padStart(2,'0')}`
  await supabase.from('expenses').insert({ description: exp.description, amount: exp.amount, category: exp.category, date, recurring:false, recurring_key:key, parent_id: exp.id })
}
```
Incluir no contador/retorno do cron (ex.: expensesGenerated) seguindo o estilo existente. Usa o admin client já em uso no cron.

## 5. UI — Financeiro
Criar `components/financial/ExpensesSection.tsx` ('use client') e renderizá-lo na página `app/(dashboard)/financial/page.tsx` (que deve passar a buscar expenses e passar como prop, OU o componente busca via GET /api/expenses ao montar — escolher o que casar com o padrão da página; TransactionManager recebe dados via props da page, então prefira buscar na page e passar por prop).
ExpensesSection deve ter:
- Título "Despesas" + total do mês atual (soma recurring=false do mês) e botão "Nova despesa".
- Formulário (modal ou inline) de nova despesa: descrição, valor, categoria (select com as categorias sugeridas + opção de texto livre), data, checkbox "Recorrente todo mês" que revela input "dia do mês" (1-31). Se recorrente: cria template (recurring=true, recurring_day, date = próxima ocorrência ou hoje). Senão: avulsa (recurring=false).
- Lista das despesas do período (recurring=false), com categoria (badge), data, valor (em vermelho/âmbar p/ diferenciar de receita), e ação de excluir (useConfirm) e editar.
- Uma sub-seção "Recorrentes configuradas" listando os templates (recurring=true) com descrição/valor/dia, e ação de remover (que apaga o template; instâncias já geradas permanecem via ON DELETE CASCADE? NÃO — parent_id tem ON DELETE CASCADE, então apagar o template apaga as instâncias. Para preservar histórico, ao "desativar" um recorrente, preferir um UPDATE recurring=false em vez de DELETE. Implementar o botão como "Parar recorrência" = PATCH {recurring:false} no template, mantendo instâncias. Deixar isso claro no texto do botão).
- Tokens Korvus, reusar formatCurrency, Card, useToast, useConfirm, bulkRun se fizer ações em massa (opcional).

## 6. Relatórios (Receita − Despesas = Lucro)
- `app/(dashboard)/reports/page.tsx`: buscar expenses com `recurring=false` (todas, ou do período — o ReportsClient já filtra por range no client; passar todas as recurring=false e deixar o client filtrar por data, seguindo como faz com transactions). Passar `expenses` como prop ao ReportsClient.
- `components/reports/ReportsClient.tsx`: adicionar KPIs:
  - "Despesas" = soma das expenses (recurring=false) no período selecionado.
  - "Lucro líquido" = (receita RECEBIDA no período) − (despesas no período). Deixar claro o critério (recebido, não pendente). Cor verde se ≥0, vermelho se <0.
  - Incluir Despesas e Lucro no export Excel (nova aba ou nos KPIs) e no PDF (KPIs).
  - Opcional: uma pequena série mensal de despesas junto da receita mensal, se trivial; senão, só os KPIs.

## Não-escopo
- Centro de custos, anexos de nota fiscal, fluxo de aprovação, múltiplas moedas, frequências além de mensal (semanal/anual).

## Regras duras
- createClient (sessão/RLS) nas rotas; admin client só no cron (como já é). NÃO tocar proxy.ts. NÃO commit/push/deploy.
- Totais NUNCA somam templates (recurring=true). Evitar `any`. Tokens Korvus. Respeitar server/client boundaries.
- Reusar helpers/primitivos existentes (formatCurrency, Card, PageHeader, useToast, useConfirm, export-excel/pdf).

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` — 65 testes continuam verdes.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, build, testes, lint, decisões (formato do "parar recorrência", como o lucro é calculado, onde as despesas entram no Relatório/export).
