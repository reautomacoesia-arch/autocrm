import * as XLSX from 'xlsx'

/**
 * Gera e baixa um arquivo .xlsx no navegador a partir de uma lista de linhas.
 * As chaves de cada objeto em `rows` se tornam os cabeçalhos das colunas —
 * usar rótulos em pt-BR legíveis (ex.: { 'Nome': c.name, 'MRR': c.monthly_value }).
 */
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
