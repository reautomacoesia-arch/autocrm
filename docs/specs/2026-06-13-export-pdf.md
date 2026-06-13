# Exportar Relatório em PDF — Korvus CRM

> Spec aprovado em 2026-06-13. Implementação delegada a agente Sonnet.
> Adiciona "Exportar PDF" na tela de Relatórios — um documento limpo e printável (tema claro + dourado Korvus), pronto pra compartilhar.

## Biblioteca
`npm install jspdf jspdf-autotable` (client-side). Uso moderno (API funcional):
```ts
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
// autoTable(doc, { ... })
```

## 1. Util: `lib/export-pdf.ts` (NOVO, reaproveitável)
Tema do documento (claro, para impressão/compartilhamento; NÃO o tema dark da UI):
- Fundo branco, texto cinza-escuro (#1a1a1d / #333), dourado Korvus `#d4af37` para a faixa de título e cabeçalho das tabelas.
Exportar funções:
- `newReportDoc(title: string, subtitle?: string): jsPDF` — cria o doc A4 retrato, desenha uma faixa de título no topo (retângulo dourado fino ou título dourado "KORVUS CRM" + `title`), e o `subtitle` (ex.: período) e a data de emissão em cinza abaixo. Retorna o doc com um cursor de Y interno controlado pelas funções abaixo (use uma variável de Y ou `doc.lastAutoTable.finalY`).
- `addKpiGrid(doc, kpis: { label: string; value: string }[])` — desenha os KPIs em blocos (2-3 colunas), label pequeno cinza + valor maior preto. Pode ser implementado como uma autoTable sem cabeçalho/bordas, ou desenho manual. Mantém espaçamento e avança o Y.
- `addSection(doc, heading: string, head: string[], body: (string | number)[][])` — escreve um heading (negrito) e uma `autoTable` com `headStyles` dourado (fillColor [212,175,55], textColor escuro), `styles` com fontSize ~9, zebra leve. Avança o Y para `doc.lastAutoTable.finalY`.
- `saveReportDoc(doc, filename: string)` — `doc.save(`${filename}-${YYYY-MM-DD}.pdf`)`.
Cuidar de quebra de página automática (autoTable já quebra; para o KPI grid, checar se Y ultrapassa a altura e `doc.addPage()`).

## 2. ReportsClient.tsx
Adicionar botão "Exportar PDF" (ícone lucide `FileText` ou `FileDown`) ao lado do "Exportar Excel" já existente no `PageHeader`/ações. Estilo dark Korvus coerente com o botão de Excel.
Ao clicar, montar o documento com os MESMOS dados que o Excel já exporta (reusar os cálculos/derivados que a tela já tem):
- Cabeçalho: título "Relatório" + subtítulo com o período selecionado (3m/6m/12m/Tudo) e a data.
- KPIs: MRR atual, Recebido, Pendente, Taxa de ganho, Propostas aprovadas (+valor), Previsão de receita, Pipeline aberto, Taxa de churn, MRR perdido.
- Seções (autoTable): Receita mensal (Mês, Recebido, Pendente); Funil do pipeline (Estágio, Qtd, Valor); Origem dos leads (Origem, Qtd); Tempo médio por etapa (Estágio, Dias, Amostras); Propostas (Status, Qtd, Valor).
Formatar moeda em pt-BR (reusar formatCurrency; no PDF pode usar a string formatada).
Arquivo: `relatorio`.

## Não-escopo
- PDF de proposta/cliente individual (a geração de propostas já é tratada pelo subprojeto gerador_propostas). Só Relatórios por enquanto.
- Gráficos renderizados no PDF (exportar só tabelas/KPIs; sem capturar canvas/SVG dos charts).

## Regras duras
- NÃO tocar proxy.ts, rotas de API, schema, checklists, notificações. NÃO commit/push/deploy.
- Client-side only. Evitar `any` (tipar linhas/colunas). Reusar helpers de formatação existentes.
- Tema do PDF é claro (impressão); o botão na UI segue o tema dark Korvus.

## Verificação (obrigatória antes de reportar)
1. `npm install jspdf jspdf-autotable` ok (consta em package.json).
2. `npx next build` sem erros novos.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados (+ package.json), conteúdo do PDF, build, lint, decisões.
