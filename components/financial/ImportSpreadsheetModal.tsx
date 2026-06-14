'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, AlertCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'

export interface ImportColumn {
  key: string
  label: string
  required?: boolean
}

interface ParsedRow<Row> {
  raw: Record<string, unknown>
  row?: Row
  error?: string
}

export interface ImportSpreadsheetModalProps<Row> {
  isOpen: boolean
  onClose: () => void
  title: string
  columns: ImportColumn[]
  templateRows: Record<string, string | number>[]
  mapAndValidate: (raw: Record<string, unknown>) => { row?: Row; error?: string }
  onImport: (rows: Row[]) => Promise<{ inserted: number; failed: number }>
  onDone: () => void
}

/**
 * Normaliza um rótulo de cabeçalho para comparação: minúsculas, sem acento,
 * sem espaços extras. Permite casar "Descrição", "descricao", " Descrição " etc.
 */
function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Busca o valor de uma linha crua pelo rótulo da coluna, tolerando variações
 * de acentuação/maiúsculas e espaços no cabeçalho.
 */
export function getCell(raw: Record<string, unknown>, label: string): unknown {
  if (label in raw) return raw[label]
  const target = normalizeHeader(label)
  for (const key of Object.keys(raw)) {
    if (normalizeHeader(key) === target) return raw[key]
  }
  return undefined
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)

/**
 * Converte o valor de uma célula de data para 'YYYY-MM-DD'.
 * Aceita: Date (cellDates:true), número (serial Excel), string
 * 'YYYY-MM-DD' ou 'DD/MM/YYYY' (ou 'DD/MM/YY').
 * Retorna null se não for possível interpretar.
 */
export function parseSheetDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    try {
      const parsed = XLSX.SSF.parse_date_code(value)
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const y = parsed.y
        const m = String(parsed.m).padStart(2, '0')
        const d = String(parsed.d).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    } catch {
      // segue para o cálculo manual abaixo
    }
    const ms = EXCEL_EPOCH_UTC + value * 86_400_000
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) return null
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    // 'YYYY-MM-DD'
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (iso) {
      const [, y, m, d] = iso
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // 'DD/MM/YYYY' ou 'DD/MM/YY'
    const br = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (br) {
      const [, d, m, yRaw] = br
      const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    return null
  }

  return null
}

/**
 * Converte o valor de uma célula de valor monetário para número.
 * Aceita número direto, ou string com "R$", separador de milhar "."
 * e decimal "," (pt-BR), ou número simples com ".".
 * Retorna null se não for possível interpretar.
 */
export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    let s = value.trim()
    if (!s) return null
    s = s.replace(/R\$\s*/gi, '').replace(/\s/g, '')

    const hasComma = s.includes(',')
    const hasDot = s.includes('.')

    if (hasComma && hasDot) {
      // formato pt-BR: "1.234,56" -> remover pontos de milhar, trocar vírgula por ponto
      s = s.replace(/\./g, '').replace(',', '.')
    } else if (hasComma) {
      // "1234,56" -> "1234.56"
      s = s.replace(',', '.')
    }
    // senão: "1234.56" ou "1234" já no formato aceito por Number()

    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  return null
}

export default function ImportSpreadsheetModal<Row>({
  isOpen,
  onClose,
  title,
  columns,
  templateRows,
  mapAndValidate,
  onImport,
  onDone,
}: ImportSpreadsheetModalProps<Row>) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow<Row>[]>([])
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const validRows = parsedRows.filter((r) => !r.error)
  const invalidRows = parsedRows.filter((r) => r.error)

  function handleClose() {
    setParsedRows([])
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet(
      templateRows.length > 0
        ? templateRows
        : [Object.fromEntries(columns.map((c) => [c.label, '']))]
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo')
    XLSX.writeFile(wb, `modelo-${title.toLowerCase().replace(/\s+/g, '-')}.xlsx`)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheetName = wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

      const results: ParsedRow<Row>[] = rawRows.map((raw) => {
        const { row, error } = mapAndValidate(raw)
        return { raw, row, error }
      })

      setParsedRows(results)
      if (results.length === 0) {
        toast('A planilha está vazia.', 'error')
      }
    } catch {
      toast('Não foi possível ler o arquivo. Verifique o formato (.xlsx, .xls ou .csv).', 'error')
      setParsedRows([])
    }
  }

  async function handleImport() {
    const rows = validRows.map((r) => r.row as Row)
    if (rows.length === 0) return
    setImporting(true)
    try {
      const { inserted, failed } = await onImport(rows)
      if (failed > 0) {
        toast(`${inserted} importada(s), ${failed} falharam`, inserted > 0 ? 'info' : 'error')
      } else {
        toast(`${inserted} importada(s) com sucesso`)
      }
      onDone()
      handleClose()
    } catch {
      toast('Erro ao importar planilha.', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Colunas esperadas:</span>
          {columns.map((c) => (
            <span
              key={c.key}
              className="bg-[#050505] border border-slate-700 rounded px-2 py-0.5 text-slate-300"
            >
              {c.label}{c.required ? ' *' : ''}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-lg px-3 py-1.5 text-xs transition-colors"
          >
            <Download size={13} />
            Baixar modelo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-lg px-3 py-1.5 text-xs transition-colors"
          >
            <Upload size={13} />
            Selecionar arquivo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          {fileName && <span className="text-slate-500 text-xs truncate max-w-[200px]">{fileName}</span>}
        </div>

        {parsedRows.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-400">{validRows.length} válida(s)</span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertCircle size={12} />
                  {invalidRows.length} com erro
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-auto border border-slate-700 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[#050505] sticky top-0">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} className="text-left text-slate-400 font-medium px-3 py-2 whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                    <th className="text-left text-slate-400 font-medium px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-t border-slate-800 ${r.error ? 'bg-red-950/30' : ''}`}
                    >
                      {columns.map((c) => (
                        <td key={c.key} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                          {String(getCell(r.raw, c.label) ?? '')}
                        </td>
                      ))}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.error ? (
                          <span className="text-red-400">{r.error}</span>
                        ) : (
                          <span className="text-emerald-400">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium"
          >
            {importing ? 'Importando...' : `Importar ${validRows.length}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
