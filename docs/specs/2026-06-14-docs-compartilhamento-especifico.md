# Documentos — compartilhar com pessoas específicas — Korvus CRM

> Spec aprovado em 2026-06-14. Implementação delegada a agente Sonnet.
> Permitir compartilhar um documento com usuários específicos (além de "pessoal" e "todos"). Migration 028 já criada.

## Dependência externa (NÃO é tarefa do agente)
`supabase/migrations/028_doc_specific_sharing.sql` JÁ EXISTE (usuário aplica manual): adiciona visibility 'specific', tabela `workspace_doc_shares (doc_id, user_id)`, funções SECURITY DEFINER `is_doc_owner`/`user_can_see_doc`, e refaz a policy SELECT de workspace_docs. Código compila mesmo antes de aplicar.

## Contexto existente (LER)
- `supabase/migrations/013_workspace_docs.sql` — workspace_docs (visibility 'personal'|'shared', created_by).
- `app/api/docs/route.ts` (GET lista, POST cria) e `app/api/docs/[id]/route.ts` (GET/PATCH/DELETE).
- `lib/api/schemas.ts` — `docVisibilityEnum = z.enum(['personal','shared'])`, docCreateSchema/docUpdateSchema.
- `lib/types.ts` — tipo do doc (WorkspaceDoc).
- UI de docs: `app/(dashboard)/docs/page.tsx`, `components/docs/DocEditorPage.tsx` (onde a visibilidade é definida — LER para achar o controle atual de visibilidade).
- `/api/profiles` retorna a lista de perfis (para escolher com quem compartilhar).

## 1. Schemas e tipos
- `lib/api/schemas.ts`: `docVisibilityEnum` passa a `z.enum(['personal','shared','specific'])`. Criar `docSharesSchema = z.object({ user_ids: z.array(uuid).max(200) })`.
- `lib/types.ts`: visibility do doc inclui 'specific'.

## 2. API — gerenciar compartilhamentos
Criar `app/api/docs/[id]/shares/route.ts`:
- `GET`: retorna os user_ids com quem o doc está compartilhado (`select user_id from workspace_doc_shares where doc_id = id`). Apenas o dono (ou quem já tem acesso) consegue — a RLS cuida; retornar [] se não houver.
- `PUT`: recebe `{ user_ids: string[] }` (validar com docSharesSchema), substitui o conjunto de shares do doc (delete os atuais + insert os novos). Só o dono (RLS garante via is_doc_owner). Idealmente: deletar todos de doc_id e inserir os novos (excluindo o próprio dono, que já tem acesso).
- createClient (sessão/RLS).

(O `PATCH /api/docs/[id]` já permite mudar visibility — garantir que aceita 'specific'.)

## 3. UI — escolher visibilidade + pessoas
No controle de visibilidade do documento (em `DocEditorPage.tsx` e/ou no fluxo de criação em `docs/page.tsx` — LER para ver onde fica hoje):
- Opções de visibilidade: **Pessoal** (só eu) · **Pessoas específicas** · **Todos** (workspace).
- Quando "Pessoas específicas": mostrar um seletor multi de perfis (buscar `/api/profiles`, excluir o próprio dono da lista), marcando quem tem acesso. Carregar os atuais via `GET /api/docs/[id]/shares`. Ao salvar, `PUT /api/docs/[id]/shares` com os selecionados (e PATCH visibility='specific'). Ao trocar para Pessoal/Todos, salvar a visibility (os shares podem ser limpos ou ignorados).
- Usar `ProfileAvatar` (existe) para exibir os perfis de forma agradável; reusar Modal/checkbox no estilo Korvus.
- Indicar visualmente nos cards/lista de docs quando um doc é "específico" (ex.: badge "Compartilhado com N pessoas") — opcional mas bom.

## Não-escopo
- Permissões de edição por pessoa (todos com acesso podem ver; edição segue sendo do dono, como hoje). Compartilhar com grupos/times. Notificar a pessoa que ganhou acesso (pode ser follow-up).

## Regras duras
- createClient (sessão/RLS) nas rotas. NÃO tocar proxy.ts/migration. NÃO commit/push/deploy.
- Evitar `any`. Tokens Korvus. Reusar Modal/ProfileAvatar/useToast. Código compila sem a migration aplicada.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` → 65 testes continuam verdes.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, build, testes, lint, decisões (onde ficou o seletor de pessoas, como salva os shares, badge).
