# Múltiplas checklists nomeadas por tarefa — Korvus CRM

> Spec aprovado em 2026-06-13. Implementação delegada a agente Sonnet.
> Hoje cada tarefa tem UMA checklist plana (`task_checklist_items`). Passar a permitir VÁRIAS checklists nomeadas e renomeáveis por tarefa.

## Dependência externa (NÃO é tarefa do agente)
A migration `supabase/migrations/024_task_checklists.sql` JÁ EXISTE (não recriar). O usuário aplica manualmente. Ela: cria `task_checklists (id, task_id, title, position, created_at)` com RLS authenticated; adiciona `task_checklist_items.checklist_id` (FK → task_checklists, ON DELETE CASCADE); faz backfill dos itens antigos numa checklist padrão "Checklist" por tarefa; cria índice. Assuma que será aplicada (após aplicar, TODO item terá `checklist_id`).

## Contexto existente (LER antes de codar)
- `components/tasks/TaskDrawer.tsx` — drawer de detalhe da tarefa; é onde a checklist atual é exibida/gerenciada. LER para seguir o estilo e ver como hoje faz fetch/CRUD dos itens.
- `app/api/tasks/[id]/checklist/route.ts` (GET lista itens, POST cria item) e `app/api/tasks/[id]/checklist/[itemId]/route.ts` (PATCH toggle/editar, DELETE) — padrão de rota a seguir.
- `lib/api/schemas.ts` — onde ficam os schemas Zod (há schema de checklist item). Adicionar schemas novos no mesmo padrão.
- `lib/types.ts` — `TaskChecklistItem` (adicionar `checklist_id: string | null`); criar `TaskChecklist`.
- Rotas usam `createClient()` (sessão + RLS). Manter.

## 1. Tipos (`lib/types.ts`)
- Novo: `export interface TaskChecklist { id: string; task_id: string; title: string; position: number; created_at: string }`.
- Em `TaskChecklistItem`: adicionar `checklist_id: string | null`.

## 2. API — checklists (NOVO grupo de rotas)
Criar `app/api/tasks/[id]/checklists/route.ts`:
- `GET`: retorna as checklists da tarefa (ordenadas por position, depois created_at) COM seus itens aninhados: `[{ id, title, position, items: TaskChecklistItem[] }]`. Itens ordenados por position. (Pode buscar checklists e itens e juntar no servidor.)
- `POST`: cria checklist `{ title?: string }` (default "Checklist"), position = (maior position atual + 1). Retorna a checklist criada (com `items: []`).

Criar `app/api/tasks/[id]/checklists/[checklistId]/route.ts`:
- `PATCH`: renomear/reordenar `{ title?: string; position?: number }`. Retorna a checklist atualizada.
- `DELETE`: apaga a checklist (cascateia itens). Retorna `{ success: true }`.

Validar body com Zod (schemas novos em `lib/api/schemas.ts`, ex.: `taskChecklistCreateSchema`, `taskChecklistUpdateSchema`). Seguir o padrão `parseBody` usado nas outras rotas.

## 3. API — itens (AJUSTAR)
- `POST /api/tasks/[id]/checklist` (criação de item): passar a EXIGIR `checklist_id` no body (validar que a checklist pertence à tarefa). Persistir `checklist_id` no insert. Atualizar o schema Zod do item.
- `[itemId]` PATCH/DELETE: sem mudança estrutural (toggle done / editar texto / apagar). Garantir que continuam funcionando.
- (Opcional) `GET /api/tasks/[id]/checklist` legado: pode manter, mas o TaskDrawer passará a usar o `GET /checklists`. Não quebrar.

## 4. UI — TaskDrawer.tsx
Substituir a seção de checklist única por uma seção de MÚLTIPLAS checklists:
- Buscar via `GET /api/tasks/[id]/checklists` ao abrir.
- Para cada checklist, renderizar um bloco com:
  - **Título editável**: clicar no título abre input inline; salvar no blur/Enter via `PATCH .../checklists/[checklistId]` (atualização otimista). Esc cancela.
  - **Progresso**: "{concluídos}/{total}" e/ou uma barra fina (opcional) com a % concluída.
  - **Itens**: checkbox (toggle done via PATCH item), texto (editável como hoje, se já era), botão remover item (DELETE item). Otimista.
  - **Adicionar item**: input "novo item" que faz `POST /checklist` com `checklist_id` daquela checklist.
  - **Remover checklist**: botão (com confirmação via `useConfirm` se disponível no projeto) → `DELETE .../checklists/[checklistId]`.
- **Botão "+ Adicionar checklist"** abaixo das checklists: cria via `POST /checklists` (título default "Checklist") e já entra em modo de renomear (foca o input do título). Permite ter quantas quiser.
- Estado vazio: se a tarefa não tem nenhuma checklist, mostrar só o botão "+ Adicionar checklist".
- Manter tokens Korvus e o visual do drawer atual (cores, espaçamentos, tamanhos de fonte).

## Não-escopo
- Drag-and-drop de reordenar checklists/itens (a coluna position existe para uso futuro; pode deixar reordenação manual de fora).
- Templates de checklist.

## Regras duras
- `createClient()` (sessão/RLS), NUNCA admin client. NÃO tocar proxy.ts. NÃO commit/push/deploy.
- Código deve compilar mesmo antes da migration aplicada (campos novos/opcionais; erros de runtime tratados com try/catch e respostas de erro — não derrubar a UI).
- Evitar `any`. Tokens Korvus de `app/globals.css`. Respeitar fronteiras server/client.
- Atualização otimista onde já é o padrão do drawer; tratar falhas revertendo ou avisando discretamente.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
3. Relatório: arquivos criados/modificados, build, lint, e decisões (formato do GET, como tratou itens legados, se incluiu barra de progresso).
