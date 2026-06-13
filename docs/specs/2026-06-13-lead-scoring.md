# Lead Scoring com IA — Fase 3 (Korvus CRM)

> Spec aprovado em 2026-06-13. Implementação delegada a agente Sonnet.
> Pontua leads (0-100) via Gemini, persiste no banco, exibe badge no kanban e permite ordenar por temperatura.

## Dependência externa (NÃO é tarefa do agente)
A migration `supabase/migrations/022_lead_scoring.sql` JÁ FOI ESCRITA. O usuário a aplica manualmente no Supabase. Ela adiciona em `leads`: `score smallint`, `score_reason text`, `scored_at timestamptz` + índice. O código deve funcionar mesmo ANTES da migration ser aplicada (campos opcionais/nullable; se a coluna não existir o UPDATE falha graciosamente com erro tratado — mas assuma que será aplicada).

## Contexto existente (reusar, NÃO refazer)
- `lib/gemini.ts` exporta `callGemini({ systemPrompt, messages, maxTokens? })` → retorna `{ text, functionCall } | null` (null se `GEMINI_API_KEY` ausente; lança em erro de rede). `messages` são `{ role: 'user' | 'model'; text: string }[]`.
- Padrão de feature de IA: ver `lib/ai-summary.ts` (`generateClientSummary`) e `app/api/clients/[id]/summary/route.ts` — SEGUIR esse padrão (rateLimit, createClient com sessão, montar contexto em texto, try/catch retornando 502).
- Tipo `Lead` em `lib/types.ts` (campos: name, company, stage, estimated_value, notes, source, next_step, created_at, updated_at...). `LeadStage = 'lead'|'contacted'|'proposal_sent'|'negotiating'|'won'|'lost'`.
- `lib/pipeline.ts`: `STAGE_LABELS`, `formatCurrency`.
- Kanban: `components/pipeline/KanbanBoard.tsx` (board, estado dos leads), `KanbanColumn.tsx`, `KanbanCard.tsx` (card, com `onLeadUpdated(updated: Lead)` para refletir mudanças). Card usa `@hello-pangea/dnd` Draggable.

## 1. Tipos (`lib/types.ts`)
Adicionar ao `interface Lead`: `score?: number | null`, `score_reason?: string | null`, `scored_at?: string | null` (opcionais, retrocompatível).

## 2. lib/ai-lead-score.ts (NOVO)
Espelhar `lib/ai-summary.ts`.
- `export async function scoreLead(context: string): Promise<{ score: number; reasoning: string }>`.
- SYSTEM_PROMPT: agente é um analista SDR. Avalia TEMPERATURA do lead (probabilidade de fechar logo) considerando: estágio no pipeline, valor estimado, engajamento/recência das interações, clareza do próximo passo, qualidade das notas. Score 0-100 (0 gelado, 100 quente). Responder ESTRITAMENTE em JSON válido, sem markdown, no formato: `{"score": <inteiro 0-100>, "reasoning": "<motivo curto em pt-BR, até 140 caracteres>"}`.
- Chamar `callGemini({ systemPrompt: SYSTEM_PROMPT, messages: [{ role: 'user', text: context }] })`.
- Se retorno null → lançar `Error('Lead scoring não configurado (defina GEMINI_API_KEY).')`. Se sem text → lançar `Error('A IA não retornou um score.')`.
- Parsear o JSON com tolerância: extrair o primeiro bloco `{...}` do texto (regex) antes do JSON.parse, caso o modelo embrulhe em texto. Clampar score em [0,100] e arredondar. reasoning: string (fallback '' ).

## 3. app/api/leads/[id]/score/route.ts (NOVO, POST)
Seguir o padrão de `app/api/clients/[id]/summary/route.ts`:
- `rateLimit(request, 'lead-score', { limit: 30, windowMs: 60_000 })`.
- `createClient()` (sessão, sujeito a RLS — NÃO admin client).
- Buscar o lead por id (`select *`). 404 se não achar.
- Montar contexto em texto: dados do lead (nome, empresa, estágio via STAGE_LABELS, valor via formatCurrency, origem, próximo passo, notas, criado/atualizado em). Buscar interações recentes do lead SE houver relação (lead pode não ter client_id; interactions são por client_id — então provavelmente NÃO há interações por lead. Incluir só se existir caminho claro; senão, basear no próprio lead). Buscar inbox_conversations com `lead_id = id` e suas últimas mensagens (até 10) para enriquecer o contexto, se existirem.
- Chamar `scoreLead(context)`. Em try/catch → 502 com a mensagem.
- `UPDATE leads SET score, score_reason, scored_at = now() WHERE id`. Retornar o lead atualizado (`.select().single()`) como JSON (para o front atualizar via onLeadUpdated).

## 4. components/pipeline/LeadScoreBadge.tsx (NOVO)
Badge de temperatura. Client ou server-safe (sem fetch).
- Props: `score: number | null | undefined`, `reason?: string | null`, `size?: 'sm' | 'md'`.
- Se score null/undefined: não renderiza nada (ou um traço sutil).
- Bandas de cor (texto/borda/bg suave): >=75 quente `red` (🔥); 50-74 morno `amber`; 25-49 frio `sky`/`blue`; <25 gelado `slate`. Usar tokens tailwind compatíveis com o tema dark (ex.: `bg-red-500/15 text-red-300 border-red-800/50`).
- Mostrar número do score + ícone (lucide `Flame` para quente, `Thermometer` para os demais — ou só Thermometer sempre). `title={reason}` no hover.

## 5. KanbanCard.tsx (editar)
- Renderizar `<LeadScoreBadge score={lead.score} reason={lead.score_reason} />` no topo do card (modo não-edição), ex.: ao lado do nome ou logo abaixo.
- Adicionar um botão pequeno "🌡 Pontuar" / "Repontuar" (se já tem score) no rodapé do card. Ao clicar (stopPropagation): `POST /api/leads/${lead.id}/score`, com estado de loading (ex.: "...") no botão; ao responder, chamar `onLeadUpdated(updated)` para refletir o novo score. Tratar erro com um aviso discreto (não quebrar o card).
- NÃO mexer na lógica de edição/custom fields existente.

## 6. KanbanBoard.tsx (editar)
- Adicionar um toggle no cabeçalho do board: "Ordenar por temperatura" (estado client, default OFF). Quando ON, ordenar os leads dentro de cada coluna por `score` desc (nulls por último); quando OFF, manter a ordem atual.
- (Opcional, se simples) botão "Pontuar não pontuados" que itera sobre os leads abertos sem `score` chamando o route single sequencialmente (respeitando rate limit), atualizando o board a cada resposta. Se ficar complexo, OMITIR e deixar só a pontuação por card — registrar no relatório.
- PRESERVAR o `PageHeader` já adicionado na Fase 1 e toda a lógica de DnD existente.

## Não-escopo
- Pontuação automática em background / cron. Webhooks. Re-score em massa agendado.

## Regras duras
- Tokens Korvus de `app/globals.css`. Reusar callGemini/STAGE_LABELS/formatCurrency/Card.
- Rota usa `createClient()` (sessão + RLS), NUNCA admin client.
- NÃO tocar proxy.ts, nem outras libs de negócio além das criadas. NÃO commit/push/deploy.
- Evitar `any`.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
3. Relatório: arquivos criados/modificados, build, lint, decisões (ex.: incluiu ou não interações; implementou ou omitiu o "pontuar todos").
