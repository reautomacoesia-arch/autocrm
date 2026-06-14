# Fluxo de caixa unificado (Receitas + Despesas) — Korvus CRM

> Spec aprovado em 2026-06-14. Implementação delegada a agente Sonnet.
> Unificar Receitas (transactions) e Despesas (expenses) numa única visão "Fluxo de caixa" com resumo, filtros ricos, lançamento e import com chave Entrada/Saída. Sem migration.

## Objetivo
Hoje `app/(dashboard)/financial/page.tsx` renderiza `TransactionManager` (receitas + config de cobrança recorrente por cliente/MRR + import) e `ExpensesSection` (despesas + templates recorrentes + import) — duas listas separadas. Unificar a parte de LANÇAMENTOS num livro-caixa único; manter as partes de CONFIGURAÇÃO (cobrança recorrente por cliente, templates de despesa recorrente) como painéis à parte.

## 1. Componente `components/financial/CashFlow.tsx` ('use client')
Recebe via props: `transactions: Transaction[]`, `expenses: Expense[]` (apenas recurring=false), `clients: Client[]`.

### Modelo unificado (normalização)
Mapear ambos para uma entrada comum:
```ts
type Entry = {
  id: string
  kind: 'income' | 'expense'
  date: string            // YYYY-MM-DD
  description: string
  detail: string          // income: nome do cliente; expense: categoria
  amount: number          // sempre positivo; sinal vem do kind
  status?: 'received' | 'pending'  // só income
  raw: Transaction | Expense
}
```
- income: de `transactions` (description = description ?? 'Receita'; detail = nome do cliente via clients map; status = type).
- expense: de `expenses` (description; detail = category ?? 'Sem categoria').
Ordenar por `date` desc (mais recente primeiro).

### Resumo (cards no topo) — recalcula conforme o filtro ativo
- **Receitas**: soma dos income com status 'received' no conjunto filtrado.
- **Despesas**: soma dos expense no conjunto filtrado.
- **Saldo**: Receitas − Despesas (verde se ≥0, vermelho se <0).
- Mostrar também, discreto, "A receber: R$ X" = soma dos income 'pending' filtrados (se > 0).

### Barra de filtros (a "coisa boa")
- **Busca** (texto): casa em description, detail (cliente/categoria) — case-insensitive, sem acento.
- **Tipo**: pills Tudo / Entradas / Saídas.
- **Período**: atalhos (Este mês [default], Mês passado, Este ano, Tudo) + intervalo personalizado com dois inputs date "De" e "Até" (quando preenchidos, sobrepõem o atalho). Filtra por `date` dentro do intervalo.
- (Opcional, se trivial) filtro de categoria p/ despesas e status p/ receitas. Se aumentar muito a complexidade, deixar de fora.
- Botão "Limpar filtros" quando algo estiver ativo. Mostrar contagem de resultados.

### Lista
- Cada linha: ícone seta (entrada verde `ArrowDownLeft` / saída vermelha `ArrowUpRight`), descrição (branco), sub-linha cinza com detail + data (formatar com `lib/format-date`), e valor à direita com sinal e cor (`+ R$` verde / `− R$` vermelho, font-mono). income pendente: badge "pendente" âmbar.
- Clique na linha abre edição (ver abaixo). Hover destaca.
- Suporte a ações em massa (reusar `useBulkSelection` + `BulkActionBar`): selecionar várias e Excluir (DELETE na rota certa por kind). Opcional mas recomendado já que o padrão existe.

### Novo lançamento (modal único com chave Entrada/Saída)
Botão "+ Novo lançamento" abre modal com toggle **Entrada** / **Saída**:
- Entrada (receita): cliente (select dos clients — obrigatório, pois transaction exige client_id), valor, data, status (recebido/pendente), descrição → POST /api/transactions.
- Saída (despesa): descrição, valor, categoria (select EXPENSE_CATEGORIES + livre), data, "recorrente todo mês" + dia → POST /api/expenses (igual ao ExpensesSection atual).
- Após criar, atualizar a lista local + toast.

### Importar Excel (reusar `ImportSpreadsheetModal`)
Botão "Importar Excel" abre um pequeno seletor Entrada/Saída (ou dois itens) e então o ImportSpreadsheetModal já existente com a config de receitas ou despesas (a mesma usada hoje em TransactionManager/ExpensesSection). Reaproveitar as funções de map/validate já escritas (mover para um util compartilhado se necessário p/ não duplicar).

### Edição / exclusão
- income: editar via PATCH /api/transactions/[id]; excluir DELETE.
- expense: editar via PATCH /api/expenses/[id]; excluir DELETE.
- Pode reusar modais/inline já existentes; se for muito, um modal simples de edição por kind. Não perder funcionalidade que já existia (editar transação, excluir, etc.).

## 2. Painéis de CONFIGURAÇÃO (manter, separados, abaixo do fluxo)
- **Cobrança recorrente por cliente (MRR)**: o painel que já existe no TransactionManager (clients com billing_day, breakdown de MRR, configurar dia) — PRESERVAR. Extrair para `components/financial/RecurringBillingPanel.tsx` se ajudar, ou manter no TransactionManager reduzido. NÃO perder essa funcionalidade.
- **Despesas recorrentes configuradas**: a sub-seção de templates (recurring=true) do ExpensesSection — PRESERVAR (listar templates, "Parar recorrência").

## 3. `app/(dashboard)/financial/page.tsx`
Buscar: transactions (todas, com client), expenses recurring=false (para o fluxo), expenses recurring=true (templates), clients (com billing info). Renderizar: `PageHeader` → `CashFlow` (fluxo unificado) → painéis de configuração (cobrança recorrente + templates de despesa). Remover a renderização duplicada das listas antigas (a lista de transações do TransactionManager e a lista de despesas do ExpensesSection passam a viver no CashFlow). Reutilizar os componentes de config.

## Não-escopo
- Conciliação bancária, saldo acumulado dia-a-dia (running balance) — só somatórios por período. Categorias em gráfico (já há ideia separada). Multi-moeda.

## Regras duras
- PRESERVAR funcionalidades existentes (criar/editar/excluir receita e despesa, import, cobrança recorrente por cliente, templates de despesa). createClient nas rotas. NÃO tocar proxy.ts/migration. NÃO commit/push/deploy.
- Evitar `any`. Tokens Korvus. Reusar Modal, Card, useToast, useConfirm, formatCurrency, lib/format-date, EXPENSE_CATEGORIES, ImportSpreadsheetModal, useBulkSelection/BulkActionBar/bulkRun.
- Totais de despesa nunca incluem templates (recurring=true) — o fluxo só recebe expenses recurring=false.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` → 65 testes continuam verdes.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, build, testes, lint, decisões (o que virou CashFlow, o que foi preservado como painel de config, como ficaram os filtros/período, edição por kind).
