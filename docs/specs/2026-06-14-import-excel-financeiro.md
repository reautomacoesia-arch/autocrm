# Importar planilha (Excel/CSV) no Financeiro — Korvus CRM

> Spec aprovado em 2026-06-14. Implementação delegada a agente Sonnet.
> Importar um arquivo .xlsx/.csv e cadastrar várias DESPESAS ou RECEITAS de uma vez, com pré-visualização + validação. Sem migration (usa expenses e transactions existentes). SheetJS (`xlsx`) já está instalado.

## Componente genérico: `components/financial/ImportSpreadsheetModal.tsx` ('use client')
Modal reutilizável de importação. Props:
```ts
interface ImportColumn { key: string; label: string; required?: boolean }
interface ImportSpreadsheetModalProps<Row> {
  isOpen: boolean
  onClose: () => void
  title: string                       // ex.: "Importar despesas"
  columns: ImportColumn[]             // colunas esperadas (rótulos pt-BR que aparecem no cabeçalho da planilha)
  templateRows: Record<string, string | number>[]  // 1-2 linhas de exemplo p/ o modelo
  mapAndValidate: (raw: Record<string, unknown>) => { row?: Row; error?: string }  // mapeia 1 linha crua -> Row tipada (ou erro)
  onImport: (rows: Row[]) => Promise<{ inserted: number; failed: number }>
  onDone: () => void                  // recarregar lista após importar
}
```
Fluxo:
1. Área de upload (input file accept=".xlsx,.xls,.csv") + botão "Baixar modelo" (gera .xlsx com `columns` como cabeçalho + `templateRows`, via SheetJS `XLSX.utils.json_to_sheet` + `writeFile`).
2. Ao escolher arquivo: ler com SheetJS (`XLSX.read(arrayBuffer, { type:'array', cellDates:true })`, primeira aba, `XLSX.utils.sheet_to_json(ws, { defval:'' })`). Para cada linha crua chamar `mapAndValidate`.
3. Preview: tabela com TODAS as linhas — válidas (normal) e inválidas (linha em vermelho + motivo do erro). Cabeçalho com "{N} válidas, {M} com erro". Só as válidas serão importadas. Permitir desmarcar linhas válidas (checkbox) opcional; se complexo, importar todas as válidas.
4. Botão "Importar {N}" chama `onImport(linhasValidas)`, mostra resultado via toast ("X importadas, Y falharam"), chama `onDone()` e fecha.
- Tokens Korvus, usar `Modal` existente (`components/ui/Modal.tsx`) e `useToast`. Evitar `any` (use generics).

### Parsing de data (IMPORTANTE — Excel é chato com datas)
Helper interno `parseSheetDate(value): string | null` que retorna 'YYYY-MM-DD':
- Se `value` é Date (cellDates:true entrega Date): formatar p/ YYYY-MM-DD em horário local.
- Se número (serial Excel): converter (`XLSX.SSF`/cálculo de serial) — aceitar via `XLSX.SSF.parse_date_code` se disponível; senão fórmula `new Date(Date.UTC(1899,11,30) + serial*86400000)`.
- Se string: aceitar 'YYYY-MM-DD' direto; aceitar 'DD/MM/YYYY' e 'DD/MM/YY' convertendo; senão retornar null (erro).

### Parsing de valor
Helper `parseAmount(value): number | null`: aceita número; aceita string "1.234,56" (pt-BR) e "1234.56"; remove "R$", espaços. Retorna null se não numérico.

## Uso 1 — Despesas (em `components/financial/ExpensesSection.tsx`)
- Botão "Importar Excel" ao lado de "Nova despesa".
- columns: [{key:'description',label:'Descrição',required:true},{key:'amount',label:'Valor',required:true},{key:'category',label:'Categoria'},{key:'date',label:'Data',required:true}]
- templateRows: ex.: [{Descrição:'Aluguel', Valor:3000, Categoria:'Aluguel', Data:'2026-06-05'}, {Descrição:'Figma', Valor:90, Categoria:'Ferramentas/Software', Data:'2026-06-10'}]
- mapAndValidate: lê as chaves pelos rótulos (Descrição/Valor/Categoria/Data — aceitar também minúsculas/sem acento via normalização), valida description não vazio, amount via parseAmount, date via parseSheetDate. Retorna Row `{ description, amount, category, date }` (recurring=false sempre — importação é de despesas avulsas).
- onImport: `POST /api/expenses/import` com `{ rows }`.

## Uso 2 — Receitas (em `components/financial/TransactionManager.tsx`)
- Botão "Importar Excel" perto de "Registrar transação".
- columns: [{key:'client',label:'Cliente',required:true},{key:'amount',label:'Valor',required:true},{key:'date',label:'Data',required:true},{key:'status',label:'Status'},{key:'description',label:'Descrição'}]
- templateRows com exemplo (Cliente: nome existente, Valor, Data, Status: 'recebido'|'pendente', Descrição).
- mapAndValidate (recebe a lista de clients do componente via closure): casa Cliente por nome (case-insensitive, trim) contra `clients`; se não achar → error "Cliente não encontrado". status: 'recebido'→'received', 'pendente'→'pending' (default 'received'). amount/date pelos helpers. Row `{ client_id, amount, type, date, description }`.
- onImport: `POST /api/transactions/import` com `{ rows }`.

## API — endpoints de importação em massa
- `app/api/expenses/import/route.ts` (POST): createClient (sessão/RLS). Body `{ rows: ExpenseImportRow[] }` validado com `z.array(expenseImportRowSchema).max(1000)` (criar schema: description text(300).min(1), amount number finite, category optText(100), date dateStr). Insert em massa (`supabase.from('expenses').insert(rows.map(... recurring:false))`). Retornar `{ inserted, failed }` (em erro de insert em lote, tentar inserir e retornar a contagem; manter simples — um único insert do array; se falhar, failed = rows.length).
- `app/api/transactions/import/route.ts` (POST): createClient. Body `{ rows }` validado (`z.array` de {client_id uuid, amount number, type enum received|pending, date dateStr, description optText}). Insert em massa em `transactions`. Retornar `{ inserted, failed }`.
- Rate limit opcional (reusar `rateLimit` se já houver padrão nas rotas próximas).

## Não-escopo
- Mapeamento manual de colunas pela UI (assumir cabeçalhos pt-BR do modelo). Atualização/upsert de registros existentes (só inserção). Importar despesas recorrentes (só avulsas).

## Regras duras
- createClient (sessão/RLS) nas rotas. NÃO tocar proxy.ts/migration. NÃO commit/push/deploy.
- Evitar `any` (generics no modal). Tokens Korvus. Reusar Modal, useToast, formatCurrency, EXPENSE_CATEGORIES.
- Datas sempre normalizadas p/ 'YYYY-MM-DD'. Valores sempre número.

## Verificação (obrigatória antes de reportar)
1. `npx next build` sem erros novos.
2. `npx vitest run` → 65 testes continuam verdes.
3. `npx eslint` nos arquivos tocados sem erros novos (ignorar baseline gerador_propostas).
4. Relatório: arquivos criados/modificados, build, testes, lint, decisões (parsing de data/valor, matching de cliente, comportamento do preview).
