# Ações em massa nas listas — Korvus CRM

> Spec aprovado em 2026-06-13. Implementação delegada a agente Sonnet.
> Selecionar vários itens e aplicar a mesma ação. Só UI + chamadas às rotas existentes (PATCH/DELETE por item). Sem migration, sem rotas novas.

## Primitivos reaproveitáveis

### `lib/hooks/useBulkSelection.ts` (NOVO) — ou `components/ui/useBulkSelection.ts`
Hook client que gerencia um `Set<string>` de ids selecionados:
- Retorna: `selected: Set<string>`, `count: number`, `isSelected(id)`, `toggle(id)`, `toggleAll(ids: string[])` (se todos já selecionados → limpa esses; senão → adiciona todos), `allSelected(ids)`, `clear()`.
- Tipar bem, sem `any`.

### `components/ui/BulkActionBar.tsx` (NOVO)
Barra de ações (apresentacional). Props: `count: number`, `onClear: () => void`, `children: React.ReactNode` (botões de ação).
- Visual: barra no topo da lista (dentro do fluxo, `mb-3`), `bg-[#1a1a1d] border border-[#d4af37] rounded-lg px-4 py-2.5 flex items-center justify-between`. Esquerda: ícone de check dourado + "{count} selecionado(s)" + botão "limpar" (X, discreto). Direita: `children` (os botões específicos da tela).
- Só renderiza quando `count > 0` (o componente pode retornar null se count===0, ou o caller condiciona).
- Tokens Korvus. Botões de ação seguem o estilo: `border border-slate-700 text-slate-300 hover:text-white rounded-md px-3 py-1.5 text-xs flex items-center gap-1.5`; ação destrutiva usa `border-red-800/60 text-red-400`.

## Padrão de cada lista
- Adicionar checkbox por linha (à esquerda) + um "selecionar todos" (no cabeçalho da lista ou na própria BulkActionBar) que opera sobre o conjunto VISÍVEL/filtrado.
- O clique no checkbox NÃO deve disparar o clique da linha (stopPropagation).
- Renderizar `BulkActionBar` acima da lista quando `count > 0`.
- Cada ação em massa: itera sobre os ids selecionados chamando a rota existente (idealmente em `Promise.all`), faz atualização otimista do estado local, mostra `toast` ("X tarefas concluídas", etc.), e `clear()` a seleção ao fim. Ações destrutivas usam `useConfirm` (`components/ui/ConfirmModal`) mostrando a quantidade ("Excluir 3 itens? Esta ação não pode ser desfeita.").
- Em caso de erro parcial, avisar via toast (best-effort); não precisa rollback elaborado.

## Telas e ações

### 1. Tarefas — `components/tasks/TaskList.tsx`
- Seleção SÓ na visão LISTA (`viewMode === 'list'`). Na kanban, não adicionar seleção.
- Checkbox por linha no `renderTask` (à esquerda, antes do círculo de status). "Selecionar todos" opera sobre `filtered`.
- Ações: **Concluir** (PATCH `/api/tasks/{id}` `{status:'done'}`), **Prioridade** (menu pequeno: Alta/Média/Baixa → PATCH `{priority}`), **Excluir** (DELETE `/api/tasks/{id}`, com confirmação).
- PRESERVAR toda a lógica existente (filtros, persistência de view, export Excel, drawer, auto-open ?new=1). Só adicionar seleção + barra.

### 2. Clientes — `components/clients/ClientList.tsx`
- Checkbox por linha; "selecionar todos" sobre a lista visível (`sorted`/filtrada).
- Ações: **Mudar status** (menu: Ativo/Pausado/Churned conforme os status reais do projeto → PATCH `/api/clients/{id}` `{status}`), **Excluir** (DELETE, confirmação).
- LER o componente para os status reais e o formato das linhas.

### 3. Propostas — `components/proposals/ProposalList.tsx`
- Checkbox por linha; "selecionar todos" sobre a lista da aba/filtro atual.
- Ações: **Mudar status** (Rascunho/Enviada/Aprovada/Rejeitada conforme reais → PATCH `/api/proposals/{id}` `{status}`), **Excluir** (DELETE, confirmação).

### 4. Financeiro — `components/financial/TransactionManager.tsx`
- Checkbox por linha de transação; "selecionar todos" sobre `filteredTransactions`.
- Ações: **Excluir** (DELETE `/api/transactions/{id}`, confirmação). (Se existir um campo simples tipo "pago"/status, pode adicionar "marcar como pago"; senão, só excluir.)

## Regras duras
- Reusar rotas existentes (PATCH/DELETE por id). NÃO criar rotas novas, NÃO tocar proxy.ts, schema, migration. NÃO commit/push/deploy.
- Reusar `useConfirm`, `useToast`, tokens Korvus. Evitar `any`. Respeitar 'use client'.
- Se alguma lista tiver estrutura que torne a seleção arriscada/complexa, implementar o que for sólido e REGISTRAR no relatório o que ficou de fora (não quebrar a tela).

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
3. Relatório: arquivos criados/modificados, ações por tela, build, lint, decisões e o que (se algo) ficou de fora.
