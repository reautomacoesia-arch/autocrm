# Gráficos no Fluxo de caixa — Korvus CRM

> Spec aprovado em 2026-06-14. Implementação delegada a agente Sonnet.
> Adicionar 2 gráficos ao Fluxo de caixa: pizza de despesas por categoria + barras receita×despesa por mês. Sem migration, sem API nova. Usa recharts (já instalado, ver `components/reports/ReportsClient.tsx`).

## Onde
Dentro de `components/financial/CashFlow.tsx`, uma seção de gráficos entre o resumo (cards) e a lista. Pode ser um subcomponente `components/financial/CashFlowCharts.tsx` que recebe as `entries` JÁ FILTRADAS (o mesmo array que alimenta a lista, respeitando busca/tipo/período/cliente) — assim os gráficos refletem a visão atual.
- Seção recolhível ("Mostrar/ocultar gráficos"), default visível. Título discreto.
- Layout: 2 colunas em telas largas (grid), empilha no estreito.

## Dados (derivar das entries filtradas)
- **Pizza — Despesas por categoria**: somar `amount` das entries `kind==='expense'` agrupadas por `detail`/categoria (usar a categoria; "Sem categoria" quando vazia). Cada fatia = categoria. Se não houver despesas no filtro: estado vazio "Sem despesas no período".
- **Barras — Receita × Despesa por mês**: agrupar entries por mês (`date.slice(0,7)` → YYYY-MM) dentro do conjunto filtrado; para cada mês, duas barras: Receita (soma income com status 'received') e Despesa (soma expense). Ordenar por mês asc; rótulo do eixo X = "mmm/aa" (pt-BR). Se 0 meses: estado vazio.

## Visual (recharts, padrão do ReportsClient)
- `ResponsiveContainer` (height ~240). Fundo transparente; texto/eixos em tom slate; tooltip com fundo `#1a1a1d` e borda slate (seguir o estilo já usado no ReportsClient — reaproveitar formatadores/cores se houver).
- Cores Korvus: Receita = dourado `#d4af37` (ou emerald `#1d9e75` para "positivo"); Despesa = vermelho `#e24b4a`. Pizza: paleta de tons (pode usar uma lista fixa de cores Korvus/variações — dourado, emerald, sky, amber, rosa, slate); manter legível no dark.
- Valores em tooltip formatados com `formatCurrency`.
- Não usar `any` (tipar os dados dos gráficos; se precisar em tooltip custom, tipar minimamente).

## Regras duras
- Só apresentação; reaproveitar `entries` já calculadas no CashFlow (não refazer fetch). NÃO tocar API/proxy/migration. NÃO commit/push/deploy.
- recharts já é dependência (confirmar no import de ReportsClient). Tokens Korvus. Respeitar 'use client' (CashFlow já é client).
- Não quebrar nada do CashFlow atual (filtros, lista, lançamento, import, ações em massa).

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` → 65 testes continuam verdes.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, build, testes, lint, decisões (como agrupou, cores, recolhível, estados vazios).
