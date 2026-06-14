# Despesa vinculada a cliente (lucro por cliente) — Korvus CRM

> Spec aprovado em 2026-06-14. Implementação delegada a agente Sonnet.
> Permitir vincular uma despesa (Saída) a um cliente, e filtrar o fluxo de caixa por cliente para ver o lucro dele (receita − custos). Migration 027 já criada.

## Dependência externa (NÃO é tarefa do agente)
`supabase/migrations/027_expenses_client.sql` JÁ EXISTE (usuário aplica manual). Adiciona `expenses.client_id uuid` (nullable, FK clients ON DELETE SET NULL) + índice. Código compila mesmo antes de aplicar (campo opcional).

## 1. Tipos e schemas
- `lib/types.ts`: adicionar `client_id: string | null` ao interface `Expense`.
- `lib/api/schemas.ts`: adicionar `client_id: optUuid` em `expenseCreateSchema` e (por herança .partial()) no update; adicionar `client_id` (optUuid) também em `expenseImportRowSchema`.

## 2. API
- `app/api/expenses/route.ts` POST: persistir `client_id: body.client_id ?? null` no insert.
- `app/api/expenses/[id]/route.ts` PATCH: incluir `client_id` quando vier no body (mesmo padrão dos outros campos).
- `app/api/expenses/import/route.ts`: incluir `client_id` no insert das linhas (quando presente).
- `app/api/cron/route.ts` (geração de despesa recorrente): ao buscar templates incluir `client_id` no select e copiá-lo para a instância gerada (custo recorrente de ferramenta dedicado a um cliente continua atribuído a ele todo mês).

## 3. UI — formulário de Saída (em `components/financial/CashFlow.tsx`)
No modal "+ Novo lançamento" aba Saída (e no modal de edição quando kind==='expense'): adicionar um select **Cliente (opcional)** — primeira opção "Geral (sem cliente)" + lista de `clients`. Enviar `client_id` (ou null) no POST/PATCH de expense.
- Também no `components/financial/RecurringExpensesPanel.tsx` (form de template recorrente, se ele permite criar/editar template): adicionar o mesmo select de cliente, para custos recorrentes por cliente.

## 4. UI — exibição e FILTRO por cliente (CashFlow)
- Na lista, no `detail` de uma saída com `client_id`: mostrar o nome do cliente junto da categoria (ex.: "Ferramentas · Cliente ABC").
- Na barra de filtros, adicionar um **select "Cliente"** (Todos / lista de clients). Quando um cliente é selecionado:
  - Filtra o fluxo para mostrar SÓ os lançamentos daquele cliente: income = transactions com `client_id` === selecionado; expense = expenses com `client_id` === selecionado.
  - O resumo passa a representar o cliente: Receitas (recebidas dele) − Despesas (atribuídas a ele) = **Saldo = lucro do cliente**. (Mantém a mesma lógica de cards, só muda o conjunto filtrado.)
  - Idealmente, quando há cliente selecionado, rotular o card Saldo como "Lucro do cliente" (texto dinâmico) — opcional mas recomendado.
- O filtro de cliente combina com os demais (período, tipo, busca).

## Não-escopo
- Rateio automático de uma despesa entre vários clientes (1 despesa = 0 ou 1 cliente). Visão de lucro por cliente dentro da pasta do cliente (pode ser follow-up). Coluna Cliente no modelo de import de despesa é opcional — incluir se trivial.

## Regras duras
- createClient nas rotas; admin client só no cron. NÃO tocar proxy.ts. NÃO commit/push/deploy.
- Evitar `any`. Tokens Korvus. Reusar selects/estilos existentes. Despesa sem cliente continua válida (Geral). Totais nunca incluem templates (recurring=true).
- Código compila mesmo antes da migration 027 aplicada.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` → 65 testes continuam verdes.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos modificados, build, testes, lint, decisões (como ficou o filtro por cliente e o rótulo de lucro, se o import ganhou coluna Cliente).
