# Drill-down nos Relatórios (clicar no gráfico → ver detalhes) — Korvus CRM

> Spec aprovado em 2026-06-14. Implementação delegada a agente Sonnet.
> Ao clicar num segmento de um gráfico dos Relatórios, abrir um modal listando os registros por trás daquele número. Sem migration, sem rota nova (só enriquecer as queries que a page já faz).

## 1. Enriquecer dados em `app/(dashboard)/reports/page.tsx`
As queries hoje trazem campos agregados sem identificação. Ampliar os SELECTs e os tipos passados ao ReportsClient:
- **leads**: adicionar `name, company` → `select('id, name, company, stage, estimated_value, source, created_at')`.
- **transactions**: adicionar `description` e nome do cliente → `select('amount, type, date, description, clients(name)')`. (No client mapear para `client_name`.)
- **proposals**: adicionar identificação e data → `select('status, value, created_at, clients(name), leads(name)')` (mapear para `client_name`/`lead_name`).
Manter os campos já existentes. Atualizar os tipos no page e no ReportsClient de acordo. (Supabase retorna joins como objeto/array — normalizar para string no map, ex.: `client_name: row.clients?.name ?? null`.)

## 2. Componente `components/reports/DetailModal.tsx` (NOVO, genérico)
Reusar `components/ui/Modal.tsx`. Props:
```ts
interface DetailColumn { key: string; label: string; align?: 'left' | 'right' }
interface DetailModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  columns: DetailColumn[]
  rows: Record<string, React.ReactNode>[]
  emptyMessage?: string
}
```
Renderiza uma tabela compacta (tokens Korvus, dark) com cabeçalho e as linhas; rodapé com contagem ("{n} registro(s)"). Scroll vertical se muitas linhas (max-h). Valores monetários já formatados pelo chamador.

## 3. Drill-down em cada gráfico (ReportsClient)
Adicionar estado `const [detail, setDetail] = useState<{title, subtitle?, columns, rows} | null>(null)` e renderizar `<DetailModal isOpen={!!detail} ... />`. Em cada gráfico, wire o clique:

- **Funil do pipeline** (Bar por estágio): `onClick` na `<Bar>` (ou nas `<Cell>`) → identifica o estágio clicado → rows = leads daquele stage. Colunas: Nome, Empresa, Valor estimado (fmt), Origem (SOURCE_LABELS). Título "Funil · {Estágio}".
- **Origem dos leads** (Bar por origem): clique → leads com aquela source. Colunas: Nome, Empresa, Estágio (STAGE_LABELS), Valor estimado. Título "Origem · {label}".
- **Receita mensal** (BarChart agrupado): usar `onClick` do BarChart (activeLabel = rótulo do mês) → mapear de volta para YYYY-MM → transactions daquele mês. Colunas: Data, Descrição, Cliente, Tipo (Recebido/Pendente), Valor (fmt). Título "Receita · {mês}".
- **Propostas por status** (Pie): `onClick` na fatia/Cell → proposals com aquele status. Colunas: Cliente/Lead (client_name ?? lead_name ?? '—'), Valor (fmt), Data. Título "Propostas · {status}".
- **Tempo médio por etapa** (Bar por estágio): para permitir detalhe, ao calcular `stageTimeData`, manter também, por estágio, a lista `{ leadId, name, company, days }[]` (rastrear identidade do lead, não só o número). Clique → mostra esses leads. Colunas: Nome, Empresa, Dias naquele estágio (fmtDays). Título "Tempo em {Estágio}".

Notas de implementação:
- Recharts: para Bar use `onClick` no elemento `<Bar onClick={(data)=>...}>` (recebe o datum) — o datum tem o `stage`/`source`/etc. já presente nos data arrays. Para o BarChart de receita (2 séries por mês) use `onClick` no `<BarChart onClick={(state)=> state?.activeLabel}>`. Para Pie, `onClick` no `<Pie onClick={(data)=>...}>` ou nas `<Cell>`.
- Adicionar `cursor: pointer` (estilo) onde clicável e um hint visual discreto ("clique para detalhes") no subtítulo de cada card.
- Reaproveitar STAGE_LABELS/SOURCE_LABELS/PROPOSAL_LABELS já no arquivo. Evitar `any` (tipar os data dos gráficos; nos handlers do recharts, tipar minimamente o necessário).

## Não-escopo
- Drill-down nos KPIs (cards) — só nos gráficos. Exportar o detalhe (pode ser follow-up). Paginação no modal (scroll basta).

## Regras duras
- Só apresentação + ampliação de SELECT (sem novas rotas/migration). NÃO tocar proxy.ts. NÃO commit/push/deploy.
- Tokens Korvus, reusar Modal. Evitar `any`. Não quebrar export Excel/PDF nem os gráficos atuais.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` → 65 testes continuam verdes.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, build, testes, lint, decisões (quais gráficos ganharam drill-down, como tratou o clique no recharts, enriquecimento de dados).
