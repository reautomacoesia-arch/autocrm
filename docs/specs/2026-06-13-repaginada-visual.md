# Repaginada Visual — Fase 1 (Korvus CRM)

> Spec aprovado em 2026-06-13. Implementação delegada a agente Sonnet.
> Escopo: **só camada de apresentação**. Zero mudança de schema, zero mudança de regra de negócio.

## Objetivo
Elevar a percepção de qualidade do CRM extraindo primitivos reutilizáveis e aplicando-os em todas as páginas. Hoje o padrão de card (`bg-[#1a1a1d] border border-slate-700 rounded-xl`) está copiado à mão em dezenas de lugares — centralizar isso é o ponto central.

## Tokens Korvus (NÃO inventar cores novas — usar os de `app/globals.css`)
- Fundo página: `#050505`
- Superfície / card: `#1a1a1d`
- Borda padrão: `border-slate-700` (#2a2a2f) · borda sutil: `border-slate-800`
- Dourado / destaque: `#d4af37` (= classe `indigo-500`); texto ativo: `indigo-400` (#dfc367)
- Texto: `text-white` → `text-slate-300` → `text-slate-400` → `text-slate-500` → `text-slate-600`
- Semânticos já em uso: `emerald-400` (positivo), `amber-400` (atenção), `red-400` (negativo)
- Fontes: títulos `font-display` (Montserrat, já global em h1-h4), números `font-mono`

## 1. Primitivos novos em `components/ui/`

### Card.tsx
Encapsula o padrão de card. Server-safe (sem 'use client').
```tsx
export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-[#1a1a1d] border border-slate-700 rounded-xl ${className}`} {...props}>
      {children}
    </div>
  )
}
```
Aceitar `className` para padding/override por uso. Tipar props como `React.HTMLAttributes<HTMLDivElement>`.

### PageHeader.tsx
Faixa de topo consistente. Server-safe.
- Props: `title: string`, `subtitle?: string`, `action?: React.ReactNode`.
- Layout: flex justify-between, título `text-white text-2xl font-bold`, subtítulo `text-slate-400 text-sm mt-1`, `action` à direita. Borda inferior `border-b border-slate-800 pb-4 mb-6`.

### Skeleton.tsx
`<div className={`animate-pulse bg-slate-800 rounded-md ${className}`} />`. Prop `className` para dimensões.

### Sparkline.tsx
Mini-gráfico SVG inline, server-safe, SEM libs externas.
- Props: `data: number[]`, `color?: string` (default `#d4af37`), `className?`.
- Normaliza `data` para um viewBox tipo `0 0 100 24`, desenha um `<polyline>` com `preserveAspectRatio="none"`, `stroke-width` ~1.5, `fill="none"`.
- Se `data.length < 2`, renderiza linha reta no meio (sem quebrar).

### TrendBadge.tsx
Pílula de tendência. Server-safe.
- Props: `delta: number`, `format?: 'percent' | 'absolute'` (default 'percent').
- `delta > 0` → verde `text-emerald-400` + ícone `TrendingUp` (lucide).
- `delta < 0` → vermelho `text-red-400` + ícone `TrendingDown`.
- `delta === 0` → slate `text-slate-500` (sem ícone, ou Minus).
- Texto: percent → `${Math.abs(delta)}%`; absolute → `${Math.abs(delta)}`. Sempre arredondar (`Math.round`).

## 2. MetricCard.tsx (upgrade retrocompatível)
Manter props atuais (`label`, `value`, `sub?`, `color?`). Adicionar:
- `trend?: { delta: number; format?: 'percent' | 'absolute' }` → renderiza `<TrendBadge>` no canto superior direito (header vira flex justify-between).
- `spark?: number[]` → renderiza `<Sparkline>` no rodapé do card, na cor correspondente ao `color`.
Quem não passar `trend`/`spark` continua idêntico ao atual.

## 3. Dados de tendência no dashboard (dados REAIS, nada mockado)
Em `app/(dashboard)/page.tsx`, adicionar helper local `bucketByWeek` e ~3 queries leves.

`bucketByWeek(rows, dateField, weeks=8, valueFn?)`:
- Cria `weeks` baldes semanais terminando hoje.
- Para cada row, joga no balde da semana de `row[dateField]`.
- Soma `valueFn(row)` (ou conta 1 se ausente) por balde → retorna `number[]` de tamanho `weeks`.
- `delta` = comparar último balde vs penúltimo (ou vs 4 atrás para MRR), em % ou absoluto.

Aplicar:
- **MRR**: buscar clients ativos com `created_at, monthly_value`. Sparkline = soma CUMULATIVA de monthly_value por semana de entrada (linha de crescimento). Delta percent vs 4 semanas atrás.
- **Leads ativos**: buscar leads (não won/lost) com `created_at`. Sparkline = contagem por semana. Delta percent semana atual vs anterior.
- **Propostas abertas**: proposals draft/sent com `created_at, value`. Sparkline = valor por semana. Delta percent.
- **Tarefas**: SEM sparkline e SEM trend (manter como está). Não forçar dado que não temos.

Se alguma query ficar complexa demais, é aceitável simplificar a sparkline daquele card (ou omitir só dela), mas NÃO inventar números.

## 4. Sidebar.tsx — agrupamento
Reestruturar `navItems` em grupos. Dashboard fica solto no topo (sem rótulo). Depois 3 grupos com micro-rótulo (`text-slate-600 text-[10px] uppercase tracking-wider px-3 mb-1 mt-4`):
- **Operação**: Inbox, Pipeline, Clientes, Propostas
- **Gestão**: Financeiro, Relatórios, Tarefas
- **Workspace**: Docs, Equipe, Automações, Serviços

Item ativo: além do `bg-indigo-600/20 text-indigo-400`, adicionar **barra dourada à esquerda** — `relative`, com um `<span>` absolute `left-0 top-1.5 bottom-1.5 w-[3px] bg-[#d4af37] rounded-r`. Preservar TODA a lógica existente (logout, profile, NotificationBell, busca, ProfileAvatar).

## 5. Rollout do PageHeader nas 12 páginas
Para cada page em `app/(dashboard)/**/page.tsx` (e os Client components de topo quando o título estiver lá), localizar o título ad-hoc atual (geralmente um `<h1>` + parágrafo) e substituir por `<PageHeader title=... subtitle=... action={...} />`, **preservando o botão de ação existente** (ex.: "+ Novo cliente") movido para a prop `action`.
- Dashboard (`app/(dashboard)/page.tsx`): o bloco de saudação personalizada vira `<PageHeader>` com `title` = saudação e `subtitle` = a frase de tarefas. Manter a lógica de greeting/contagem.
- Onde o título estiver dentro de um Client component (ex.: ClientList, TransactionManager, ReportsClient), aplicar lá. Não quebrar 'use client'/server boundaries — `PageHeader` é server-safe e funciona nos dois.
- Se uma página não tiver ação primária, passar só `title`/`subtitle`.

## Não-escopo (fases seguintes — NÃO fazer agora)
Foco-do-dia, mini-funil do pipeline, lead scoring, command palette com ações, ações em massa, filtros salvos.

## Verificação (obrigatória antes de reportar)
1. `npx next build` — deve compilar sem erros novos.
2. `npx eslint <arquivos tocados>` — sem erros novos (ignorar os ~1130 pré-existentes do subprojeto `gerador_propostas`; só os arquivos desta tarefa importam).
3. Listar todos os arquivos criados/modificados no relatório final.

## Convenções do projeto (importante)
- Next.js 16 (App Router). NÃO fazer push nem deploy — só implementar localmente e reportar.
- Não rodar testes (36 falhas pré-existentes não relacionadas).
- Respeitar 'use client' onde já existe; primitivos novos são server-safe exceto se precisarem de interação.
- Não tocar em rotas de API, lib de negócio, nem proxy.ts.
