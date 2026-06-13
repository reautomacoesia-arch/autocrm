# Cleanup / dedup refactor (pós code-review) — Korvus CRM

> Spec aprovado em 2026-06-13. Refatoração de manutenção: extrair duplicações apontadas no code-review.
> REGRA DE OURO: PRESERVAR COMPORTAMENTO EXATO. Build + suíte de testes (65 testes, hoje 100% verdes) devem continuar verdes. Sem migration, sem rota nova.

## 1. Centralizar destinos de navegação (3 fontes → 1)
Hoje a lista de páginas está triplicada: `components/layout/Sidebar.tsx` (navGroups), `components/search/CommandPalette.tsx` (NAV_DESTINATIONS) e `components/layout/KeyboardShortcuts.tsx` (mapa g+letra).
Criar `lib/navigation.ts`:
```ts
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Inbox, Target, Users, FileText, DollarSign, BarChart2, CheckSquare, BookOpen, Users2, Zap, Settings } from 'lucide-react'

export type NavGroup = 'Operação' | 'Gestão' | 'Workspace'
export interface NavItem { href: string; label: string; icon: LucideIcon; group: NavGroup | null; shortcut: string }

export const NAV_ITEMS: NavItem[] = [
  { href: '/',            label: 'Dashboard',   icon: LayoutDashboard, group: null,        shortcut: 'd' },
  { href: '/inbox',       label: 'Inbox',       icon: Inbox,           group: 'Operação',  shortcut: 'i' },
  { href: '/pipeline',    label: 'Pipeline',    icon: Target,          group: 'Operação',  shortcut: 'p' },
  { href: '/clients',     label: 'Clientes',    icon: Users,           group: 'Operação',  shortcut: 'c' },
  { href: '/proposals',   label: 'Propostas',   icon: FileText,        group: 'Operação',  shortcut: 'l' },
  { href: '/financial',   label: 'Financeiro',  icon: DollarSign,      group: 'Gestão',    shortcut: 'f' },
  { href: '/reports',     label: 'Relatórios',  icon: BarChart2,       group: 'Gestão',    shortcut: 'r' },
  { href: '/tasks',       label: 'Tarefas',     icon: CheckSquare,     group: 'Gestão',    shortcut: 't' },
  { href: '/docs',        label: 'Documentos',  icon: BookOpen,        group: 'Workspace', shortcut: 'o' },
  { href: '/team',        label: 'Equipe',      icon: Users2,          group: 'Workspace', shortcut: 'e' },
  { href: '/automations', label: 'Automações',  icon: Zap,             group: 'Workspace', shortcut: 'a' },
  { href: '/services',    label: 'Serviços',    icon: Settings,        group: 'Workspace', shortcut: 's' },
]
export const NAV_GROUPS: NavGroup[] = ['Operação', 'Gestão', 'Workspace']
```
- Sidebar: derivar o item Dashboard (`group === null`) e os grupos de `NAV_GROUPS.map(g => NAV_ITEMS.filter(i => i.group === g))`. Manter EXATAMENTE o visual atual (barra dourada no ativo, etc.).
- CommandPalette: a seção "Navegação"/"Ir para" passa a mapear `NAV_ITEMS` (label "Ir para {label}", href, icon). Manter comportamento de busca/filtro/teclado.
- KeyboardShortcuts: o mapa g+letra passa a ser derivado de `NAV_ITEMS` (`{ [shortcut]: href }`). Manter o overlay de ajuda (pode listar a partir de NAV_ITEMS). Confirmar que as teclas batem com as atuais (d/i/p/c/l/f/r/t/o/e/a/s).
- IMPORTANTE: o teste `__tests__/sidebar.test.tsx` deve continuar passando (renderiza todos os itens e o nome do sistema). Não mudar textos/labels.

## 2. Helper de ação em massa (6 cópias → 1)
Adicionar em `lib/hooks/useBulkSelection.ts` (ou novo `lib/bulk-actions.ts`):
```ts
export async function bulkRun<T>(ids: T[], fn: (id: T) => Promise<unknown>): Promise<{ ok: number; fail: number }> {
  const results = await Promise.allSettled(ids.map(fn))
  const fail = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as Response | undefined)?.ok === false)).length
  return { ok: ids.length - fail, fail }
}
```
Refatorar ClientList/ProposalList/TaskList (e TransactionManager) para usar `bulkRun` no lugar do `Promise.all` manual + contagem. MANTER: atualização otimista local, mensagens de toast (com contagem de falhas) e `clear()` ao fim. Não precisa adicionar rollback (fora de escopo; manter best-effort como hoje). Comportamento idêntico.

## 3. notifyAssignees compartilhado (2 cópias → 1)
Extrair a função de `app/api/tasks/route.ts` e `app/api/tasks/[id]/route.ts` para `lib/notify-assignees.ts`:
- Assinatura sugerida: `notifyAssignees(supabase, { taskTitle, assigneeIds, currentUserId }): Promise<void>` — dedup, remove o currentUserId, insere uma notificação por responsável (`user_id`, title "Você foi atribuído à tarefa: {taskTitle}", link '/tasks'), best-effort em try/catch. Ambas as rotas importam e chamam. Comportamento idêntico (criação notifica todos; PATCH notifica só os novos — a lógica de "quais ids" continua em cada rota; o helper só faz o insert).

## 4. formatDate compartilhado
Criar `lib/format-date.ts` com `formatDate(dateStr: string | null): string` (o parse seguro de 'YYYY-MM-DD' evitando shift de timezone, com fallback `toLocaleDateString('pt-BR')`). Substituir APENAS as cópias IDÊNTICAS (mesma semântica) — começar por `components/dashboard/FocusToday.tsx` e `app/(dashboard)/page.tsx`. Para variantes com opções diferentes (ex.: `{day:'2-digit', month:'short'}` no TaskKanban), NÃO forçar — deixar como está ou aceitar um segundo parâmetro de options só se trivial. Não quebrar nada.

## 5. Hook para auto-abrir modal via ?new=1 (3-4 cópias → 1)
Criar `lib/hooks/useNewParamModal.ts`:
```ts
// retorna [isOpen, setIsOpen]; inicia aberto se ?new=1 e limpa o param uma vez
export function useNewParamModal(path: string): [boolean, Dispatch<SetStateAction<boolean>>]
```
Internamente: `useState(() => searchParams.get('new') === '1')` + `useEffect` que faz `router.replace(path)` quando `?new=1` presente. Refatorar ClientList, ProposalList, KanbanBoard e TaskList para usar o hook. Em TaskList, PRESERVAR o resto (persistência de view, export, seleção em massa). Comportamento idêntico.

## 6. Trend delta no dashboard (2 cópias → 1)
Em `app/(dashboard)/page.tsx`, extrair um helper local `weekOverWeekDelta(thisWeek: number, lastWeek: number): number` (a regra: lastWeek>0 → %; senão thisWeek>0 → 100; senão 0) e usar para leads e propostas. Não alterar o MRR (já corrigido). Comportamento idêntico.

## Regras duras
- PRESERVAR COMPORTAMENTO. NÃO tocar proxy.ts, schema, migration, rotas (exceto o import do notifyAssignees). NÃO commit/push/deploy.
- Tokens Korvus. Evitar `any`. Respeitar server/client boundaries (lib/navigation.ts importa lucide — ok em client; cuidado: NÃO importar nada client-only em código server).
- ATENÇÃO: `lib/navigation.ts` será importado por client components (Sidebar/CommandPalette/KeyboardShortcuts) — está ok. Não importar em server components que não suportem.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` — TODOS os 65 testes continuam passando (rede de segurança do refactor). Se algum quebrar, corrigir antes de reportar.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, confirmação de build+testes verdes, e qualquer item que teve que ficar de fora.
