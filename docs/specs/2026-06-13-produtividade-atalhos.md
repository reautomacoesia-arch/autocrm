# Produtividade / Atalhos — Fase 4 (Korvus CRM)

> Spec aprovado em 2026-06-13. Implementação delegada a agente Sonnet.
> Só código (sem migration, sem IA). Transforma o command palette num launcher e adiciona navegação por teclado.

## Contexto existente (reusar, NÃO refazer)
- `components/search/CommandPalette.tsx` (client): já tem Ctrl/Cmd+K, evento `open-command-palette`, busca via `/api/search?q=`, navegação por setas/Enter/Esc. Atualmente só mostra resultados quando `query >= 2`.
- Registrado em `components/layout/Providers.tsx` (CONFERIR lendo o arquivo) — é onde o novo provider de atalhos também deve ser registrado.
- 12 destinos de navegação (mesma lista do `Sidebar.tsx`): `/` Dashboard, `/inbox`, `/pipeline`, `/clients`, `/proposals`, `/financial`, `/reports`, `/tasks`, `/docs`, `/team`, `/automations`, `/services`.
- Modais de criação existentes (CONFERIR nomes/props lendo): `components/clients/AddClientModal.tsx`, `components/pipeline/AddLeadModal.tsx`, e os fluxos de criar tarefa/proposta nas respectivas páginas.

## 1. CommandPalette.tsx → launcher
Adicionar dois tipos de comando ALÉM dos resultados de busca:

### Ações rápidas (quick-create)
Lista estática de 4 ações, cada uma com label, ícone (lucide) e destino:
- "Criar lead" → `/pipeline?new=1`
- "Nova tarefa" → `/tasks?new=1`
- "Nova proposta" → `/proposals?new=1`
- "Novo cliente" → `/clients?new=1`

### Navegação ("Ir para…")
Os 12 destinos acima, cada um com label "Ir para {nome}" e ícone.

### Comportamento
- Campo VAZIO (ou < 2 chars): mostrar seção "Ações" (as 4 quick-create) + seção "Navegação" (os 12). Sem busca.
- Campo >= 2 chars: mostrar (a) ações + navegação cujo label dê match (case-insensitive, sem acento) no topo, e (b) os resultados de busca da API embaixo, sob um rótulo "Resultados". 
- A navegação por setas/Enter deve percorrer a lista COMBINADA (ações+nav filtradas + resultados) numa ordem só (manter um array achatado de itens "selecionáveis" com um `onSelect`). Refatorar `activeIndex`/Enter para operar sobre esse array unificado, não só `results`.
- Cada item selecionável tem um `onSelect()`: navegação usa `router.push(href)` + `close()`. Manter o visual atual (ícone + título + rótulo de tipo à direita). Seções com micro-cabeçalho (`text-slate-600 text-[10px] uppercase tracking-wider px-4 py-1`).

## 2. Auto-abrir modal via ?new=1
Para as listas que têm modal de criação, fazer a página/cliente detectar `?new=1` (via `useSearchParams`) e abrir o modal automaticamente uma vez, limpando o param da URL (`router.replace` sem o query) para não reabrir.
- Aplicar onde for direto: clientes (`AddClientModal`) e pipeline/leads (`AddLeadModal`). Para tarefas e propostas, aplicar SE o fluxo for simples (modal/botão acessível no client component de topo); se for complexo, deixar só a navegação (sem auto-abrir) e REGISTRAR no relatório quais entidades ganharam auto-open e quais ficaram só com navegação.
- O auto-open deve ser idempotente e não rodar em loop. Respeitar 'use client'.

## 3. KeyboardShortcuts provider (NOVO, client)
Criar `components/layout/KeyboardShortcuts.tsx` ('use client') e registrá-lo em `Providers.tsx` (ao lado do CommandPalette).
- Handler global de `keydown` que IGNORA quando o foco está em `input`, `textarea` ou `[contenteditable]` (checar `e.target`), e quando há modais/campos ativos.
- `?` (shift+/) → abre um overlay de ajuda de atalhos (estado local `showHelp`).
- Navegação `g`+letra (sequência): pressionar `g` arma um modo por ~1.2s; a próxima tecla navega. Mapa sugerido: g d → `/` (dashboard), g i → `/inbox`, g p → `/pipeline`, g c → `/clients`, g r → `/reports`, g t → `/tasks`, g f → `/financial`, g o → `/docs`, g e → `/team`, g a → `/automations`, g s → `/services`. (Evitar conflito; documentar no overlay as teclas reais escolhidas.)
- Overlay de ajuda: modal simples (NÃO usar `position: fixed` problemático — seguir o padrão do CommandPalette com `fixed inset-0 z-50` que já funciona no projeto), listando os atalhos: `Ctrl/Cmd K` buscar/abrir launcher, `g` + tecla navegar, `?` esta ajuda, `Esc` fechar. Fechar com Esc ou clique no backdrop.

## Não-escopo (NÃO fazer — fica para Fase 4b)
- Ações em massa nas listas (seleção múltipla + bulk delete/status).
- Atalhos que disparam ações destrutivas.

## Regras duras
- Tokens Korvus de `app/globals.css`. Manter o visual do palette.
- Só client-side de navegação/UI. NÃO tocar rotas de API, schema, libs de negócio, proxy.ts. NÃO commit/push/deploy.
- Evitar `any`. Respeitar fronteiras server/client. Não quebrar a busca atual nem o Ctrl+K.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
3. Relatório: arquivos criados/modificados, build, lint, e decisões (quais entidades ganharam auto-open via ?new=1, mapa final de teclas g+letra).
