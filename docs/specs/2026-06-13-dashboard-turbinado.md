# Dashboard Turbinado — Fase 2 (Korvus CRM)

> Spec aprovado em 2026-06-13. Implementação delegada a agente Sonnet.
> Aditivo ao dashboard. Reaproveita dados já buscados. Zero schema novo.

## Objetivo
Transformar o dashboard de informativo em "centro de comando": destacar o que exige ação agora e dar atalhos. Usar tokens Korvus e os primitivos da Fase 1 (`Card`, `PageHeader` já existem em `components/ui/`).

## Contexto já existente (NÃO refazer)
- `app/(dashboard)/page.tsx` já busca: `myTasks` (tarefas do usuário não concluídas, com `due_date`, `priority`, `status`, `clients(name)`), `clients` ativos, `leads` (não won/lost), proposals, interactions, pipeline_events. Já tem helpers `isOverdue`, `isDueToday`, `formatDate`, `today`.
- Já existe `PageHeader` (Fase 1) usado na saudação — adicionar a prop `action` com o QuickActions.
- `lib/pipeline.ts` exporta `STAGE_LABELS` e `formatCurrency`. Estágios abertos: `lead`, `contacted`, `proposal_sent`, `negotiating` (confirmar nomes lendo `lib/pipeline.ts` / `lib/types.ts`).
- `DashboardCalendar` (client) permanece intocado.

## 1. FocusToday.tsx (`components/dashboard/`)
Painel "Foco do dia". Server-safe (recebe props, sem fetch próprio).
- Props: `overdueTasks: Task[]`, `dueTodayTasks: Task[]` (subconjuntos de `myTasks`, derivados no page.tsx com `isOverdue`/`isDueToday`).
- Topo: dois chips clicáveis (link) — "{n} em atraso" (estilo vermelho: `bg-red-500/10 text-red-400 border-red-800/50`) e "{n} para hoje" (âmbar: `bg-amber-500/10 text-amber-400 border-amber-800/50`). Cada chip linka para `/tasks`.
- Lista: as tarefas em atraso + de hoje (atraso primeiro), cada item mostrando título, cliente (se houver), prioridade e data — reusar o visual de card de tarefa que já existe no page.tsx (borda vermelha p/ atraso, âmbar p/ hoje).
- Estado vazio (nenhuma atraso nem hoje): card central com "Tudo em dia 🎉" + link "Ver todas as tarefas →".
- Envolver no primitivo `Card` quando fizer sentido.

## 2. PipelineFunnel.tsx (`components/dashboard/`)
Mini-funil. Server-safe (recebe props).
- Props: `stages: { stage: string; label: string; count: number; value: number }[]`.
- Renderiza barras horizontais por estágio aberto, largura proporcional à contagem (a maior = 100%). Cada linha: label + barra (cor dourada `bg-[#d4af37]` ou degradê de opacidade por estágio) + `count` + `formatCurrency(value)`.
- O card inteiro é um link para `/pipeline` (ou cada barra linka para `/pipeline`).
- Cabeçalho do card: "Funil do pipeline".
- Usar `Card`.

### Query no page.tsx para o funil
Adicionar uma query: buscar `leads` abertos com `stage, estimated_value` (ou o campo de valor que existir em leads — CONFERIR em `lib/types.ts`). Agrupar por `stage`, contar e somar valor. Montar o array `stages` na ordem `lead → contacted → proposal_sent → negotiating` usando `STAGE_LABELS`. Reaproveitar a query de leads existente se possível (hoje ela só pega `id`; ampliar o select para incluir `stage` e o campo de valor).

## 3. QuickActions.tsx (`components/dashboard/`)
Dropdown "+ Novo". CLIENT component ('use client').
- Botão dourado "+ Novo" (mesmo estilo do mockup: `bg-[#d4af37] text-[#050505]`). Ao clicar, abre um menu com 4 links (lucide icons): Novo lead → `/pipeline`, Nova tarefa → `/tasks`, Nova proposta → `/proposals`, Novo cliente → `/clients`.
- Fechar ao clicar fora (listener) ou ao navegar. Menu posicionado abaixo do botão (`absolute`, NÃO `fixed`).
- Passado como `action={<QuickActions />}` no `PageHeader` do dashboard.

## 4. Layout final do page.tsx
Ordem: `PageHeader` (com `action={<QuickActions/>}`) → grid de 4 MetricCards (Fase 1, intocado) → grid 2-col `[FocusToday | PipelineFunnel]` (gap-6, mb-8) → `DashboardCalendar` (intocado) → grid 2-col `[Minhas tarefas | Atividade recente]` (intocado).

## Não-escopo (NÃO fazer)
- Criação inline de registros (modais no dashboard) — só navegação por enquanto.
- Lead scoring, mini-charts extras.

## Regras duras
- Só apresentação + queries leves de leitura. NÃO tocar API routes, schema, lib de negócio, proxy.ts.
- NÃO commit/push/deploy. Só implementar.
- Tokens Korvus de `app/globals.css` apenas. Reusar `Card`/`PageHeader`/`formatCurrency`/`STAGE_LABELS` existentes.
- CONFERIR nomes reais de campos lendo `lib/types.ts` e `lib/pipeline.ts` antes de codar (estágios, campo de valor do lead).

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline do `gerador_propostas`).
3. Relatório: arquivos criados/modificados, build, lint, e decisões de simplificação (ex.: nome do campo de valor do lead).
