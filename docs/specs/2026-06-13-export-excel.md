# Exportar para Excel — Korvus CRM

> Spec aprovado em 2026-06-13. Implementação delegada a agente Sonnet.
> Adiciona um botão "Exportar Excel" (.xlsx real) nas telas de dados onde faz sentido.

## Biblioteca
Usar SheetJS: rodar `npm install xlsx` no diretório do projeto (gera .xlsx de verdade, traz os próprios tipos). Geração é client-side (`XLSX.writeFile` dispara o download no navegador) — só usar em client components (todos os alvos abaixo já são 'use client').

## 1. Utilitário compartilhado: `lib/export-excel.ts` (NOVO)
```ts
import * as XLSX from 'xlsx'

export function exportToExcel(
  filename: string,
  rows: Record<string, unknown>[],
  sheetName = 'Dados',
) {
  if (!rows.length) return
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}-${stamp}.xlsx`)
}
```
As chaves de cada objeto `rows` viram os cabeçalhos das colunas — usar rótulos em pt-BR legíveis (ex.: `{ 'Nome': c.name, 'Empresa': c.company ?? '', 'MRR': c.monthly_value }`). Formatar valores (datas em pt-BR, números como número puro para o Excel somar).

## 2. Botão padrão de exportar
Em cada tela, adicionar um botão discreto "Exportar Excel" (ícone lucide `Download` ou `FileSpreadsheet`), no cabeçalho/área de ações, estilo coerente com o tema dark Korvus (ex.: `border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5`). Exporta SEMPRE o conjunto atualmente visível/filtrado quando houver filtros (ex.: em Tarefas, exportar `filtered`; em listas sem filtro, exportar tudo). Se a lista estiver vazia, desabilitar ou não exibir.

## 3. Telas que recebem export (mapear colunas em pt-BR)
- **Clientes** (`components/clients/ClientList.tsx`): Nome, Empresa, E-mail, Telefone, Status, MRR (monthly_value), Início (started_at). Nome do arquivo: `clientes`.
- **Financeiro** (`components/financial/TransactionManager.tsx`): Data, Tipo (receita/despesa), Descrição, Cliente, Valor, Categoria/Status se houver. Arquivo: `financeiro`. (LER o componente para os campos reais.)
- **Pipeline / Leads** (`components/pipeline/KanbanBoard.tsx`): Nome, Empresa, Estágio (via STAGE_LABELS), Valor estimado, Origem, Telefone, E-mail, Score (se existir). Arquivo: `leads`. Botão no cabeçalho do board (onde já há os controles de Lead/Campos/ordenar).
- **Tarefas** (`components/tasks/TaskList.tsx`): Título, Status, Prioridade, Vencimento, Cliente, Responsáveis (nomes juntos), Tags. Exportar o `filtered` atual. Arquivo: `tarefas`. IMPORTANTE: este arquivo tem mudanças recentes (persistência de view + auto-open ?new=1) — PRESERVAR tudo, só adicionar o botão e a função de export.
- **Relatórios** (`components/reports/ReportsClient.tsx`): exportar os principais KPIs/linhas que a tela já calcula (ex.: resumo de funil por estágio, forecast, MRR/churn). LER o componente e exportar o que for tabular e útil; se for muito, focar nos números-resumo numa planilha. Arquivo: `relatorios`.

Se em alguma tela os dados não estiverem facilmente acessíveis no client (ex.: só no server), adicionar o export apenas onde for direto e registrar no relatório o que ficou de fora.

## Regras duras
- NÃO tocar proxy.ts, rotas de API, schema. NÃO commit/push/deploy.
- Tokens Korvus. Evitar `any` (tipar as linhas como `Record<string, unknown>`). Respeitar 'use client'.
- Reusar helpers existentes (formatCurrency, STAGE_LABELS, labels de status) onde já existirem, para os valores saírem consistentes.

## Verificação (obrigatória antes de reportar)
1. `npm install xlsx` concluído (aparece em package.json).
2. `npx next build` sem erros novos.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, telas que ganharam export, build, lint, e o que (se algo) ficou de fora e por quê.
