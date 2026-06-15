# Pipeline — visão lista/tabela + colunas totalmente customizáveis — Korvus CRM

> Spec aprovado em 2026-06-14. Implementação delegada a agente Sonnet.
> Estágios do pipeline deixam de ser fixos: criar/renomear/reordenar/recolorir/excluir colunas, com metadados (type ganho/perdido/aberto + probabilidade) para manter automações, taxa de ganho e forecast. Além disso, uma visão lista/tabela ao lado do kanban. Migration 029 já criada.

## Dependência externa (NÃO é tarefa do agente)
`supabase/migrations/029_pipeline_stages.sql` JÁ EXISTE (usuário aplica manual): cria `pipeline_stages (id, slug, label, color, type 'open'|'won'|'lost', probability, position)`, semeia os 6 estágios atuais com os MESMOS slugs (lead/contacted/proposal_sent/negotiating/won/lost), e remove o CHECK de leads.stage. Como o seed usa os slugs atuais, NENHUM lead existente precisa mudar. Código deve compilar e funcionar mesmo antes de aplicar (com fallback aos estágios estáticos de `lib/pipeline.ts`).

## Princípio
- Fonte de verdade dos estágios = tabela `pipeline_stages`. `leads.stage` = slug do estágio.
- `lib/pipeline.ts` mantém os estágios estáticos (STAGES/STAGE_LABELS/STAGE_COLORS) como FALLBACK (export `DEFAULT_STAGES` com os mesmos dados). Componentes preferem os estágios vindos do banco; se a lista vier vazia (migration não aplicada), usam o fallback.
- Metadados por estágio: `type` ('open'|'won'|'lost') e `probability` (0..1). Won/lost deixam de ser hardcoded por slug — passam a ser determinados por `type`.

## 1. Tipos (`lib/types.ts`)
- `export interface PipelineStage { id: string; slug: string; label: string; color: string; type: 'open'|'won'|'lost'; probability: number; position: number; created_at: string }`.
- `Lead.stage` continua `string` (hoje é `LeadStage`; manter compatível — pode alargar para `string`). NÃO quebrar usos existentes.

## 2. API — `app/api/pipeline-stages/`
- `route.ts`: GET (lista ordenada por position) e POST (cria: label obrigatório, color, type default 'open', probability default 0.3; gera `slug` único a partir do label — slugify + sufixo se colidir; position = max+1). createClient.
- `[id]/route.ts`: PATCH (label/color/type/probability) e DELETE. **DELETE deve bloquear** se existir lead com aquele slug (retornar 409 com mensagem "Mova os leads desta coluna antes de excluir"). Não permitir excluir se ficaria o pipeline sem nenhuma coluna.
- `reorder/route.ts` (POST): recebe `{ ids: string[] }` e atualiza `position` na ordem. (Ou aceitar reorder no PATCH; escolher um.)
- Schemas Zod novos em `lib/api/schemas.ts` (pipelineStageCreate/Update). Slug NÃO vem do cliente (gerado no servidor).

## 3. Pipeline page + KanbanBoard
`app/(dashboard)/pipeline/page.tsx` (LER): passa a buscar `pipeline_stages` (ordenadas) e passar para o `KanbanBoard` junto com os leads. Se vazio, usar DEFAULT_STAGES.

`components/pipeline/KanbanBoard.tsx` (LER e refatorar):
- Renderiza as colunas DINAMICAMENTE a partir das stages (não mais do array fixo). Cada coluna usa label/color da stage; arrastar lead entre colunas seta `lead.stage = stage.slug` (PATCH /api/leads/[id]).
- **Visão lista/tabela**: toggle no cabeçalho (Kanban | Lista), persistido por perfil em localStorage (mesma ideia do TaskList: chave `pipeline-view:<userId>`). Na lista: tabela com colunas Nome, Empresa, Estágio (badge com cor/label da stage), Valor, Origem, Próximo passo, Score; clicar abre edição (reusar o fluxo de edição existente / EditLeadModal); permitir mudar o estágio por um select na linha. Tokens Korvus.
- **Gerenciar colunas**: botão "Colunas" abre um modal `ManageStagesModal` para: adicionar coluna (label, cor, tipo open/ganho/perdido, probabilidade), renomear, recolorir, mudar tipo/probabilidade, reordenar (setas ↑/↓ basta; drag opcional) e excluir (com a regra de bloqueio acima). Após mudanças, recarregar as stages.
- Preservar TODO o comportamento atual do board que não conflitar (criar lead via ?new=1, ordenar por temperatura/score, export Excel, ações existentes).

## 4. Stage selects e KanbanCard
- `AddLeadModal.tsx` / edição de lead (KanbanCard inline + `EditLeadModal.tsx`): o select de estágio passa a listar as stages dinâmicas (label/slug). Hoje alguns usam enum fixo — trocar para receber/usar a lista de stages.
- `KanbanCard.tsx`: onde checa `lead.stage === 'won'` (handleCardClick), trocar para checar se o estágio do lead é do `type === 'won'`. Para isso, o card precisa conhecer o tipo do estágio — passar um mapa `stagesBySlug` (ou o tipo do estágio do lead) via props a partir do board.

## 5. Automações por TYPE (`app/api/leads/[id]/route.ts`)
Hoje dispara `lead_won` quando `body.stage === 'won'` e `lead_lost` quando `=== 'lost'`. Refatorar: ao mudar de estágio, buscar o `type` do estágio destino em `pipeline_stages` (por slug); se `type==='won'` → runAutomation 'lead_won'; se `type==='lost'` → 'lead_lost'. Manter o registro em `pipeline_events` e o `runWorkflows('lead.stage_changed', ...)`. Se a tabela não existir/sem match, fazer fallback ao comportamento atual (slug 'won'/'lost').

## 6. Relatórios (`reports/page.tsx` + `ReportsClient.tsx`)
- `reports/page.tsx`: buscar `pipeline_stages` e passar ao ReportsClient.
- `ReportsClient.tsx`: substituir os mapas hardcoded (STAGE_ORDER/STAGE_LABELS/STAGE_COLORS/STAGE_PROBABILITY/OPEN_STAGES) por dados derivados das stages recebidas (ordem = position; labels/colors/probability da stage; OPEN = type 'open'; won = type 'won'; lost = type 'lost'). Se a prop vier vazia, usar os defaults atuais. Funil, forecast, tempo por etapa, win rate, drill-down devem refletir as stages dinâmicas. Manter export Excel/PDF.

## 7. Dashboard
- `app/(dashboard)/page.tsx` (mini-funil/OPEN_STAGES) e `components/dashboard/PipelineFunnel.tsx`: usar as stages dinâmicas (buscar pipeline_stages na page e passar; OPEN = type 'open'; labels da stage). Fallback aos defaults se vazio.

## 8. Lead scoring (`lib/ai-lead-score.ts` / rota de score)
Onde usa STAGE_LABELS para montar o contexto: aceitar o label dinâmico (ou manter o slug se simples). Não é crítico; mínimo necessário para não quebrar build.

## Não-escopo
- Múltiplos pipelines/funis distintos. Drag de reordenar coluna (setas bastam). Migrar leads ao excluir coluna (bloquear é suficiente).

## Regras duras
- PRESERVAR comportamento atual (kanban, criar/editar/excluir lead, score, export, automações ganho/perdido, relatórios, dashboard). createClient nas rotas; admin client só onde já é. NÃO tocar proxy.ts. NÃO commit/push/deploy.
- Evitar `any`. Tokens Korvus. Reusar Modal/useToast/useConfirm/ProfileAvatar/formatCurrency. Fallback para DEFAULT_STAGES quando a lista de stages estiver vazia (compila/funciona sem a migration).

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` → 65 testes continuam verdes (se algum teste de pipeline quebrar por mudança de tipo, ajustar o teste minimamente mantendo a intenção).
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, build, testes, lint, decisões (como ficou a lista/tabela, gerência de colunas, automações por type, fallback, reports/dashboard dinâmicos).
