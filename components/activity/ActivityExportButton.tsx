'use client'

import { Download } from 'lucide-react'
import { exportToExcel } from '@/lib/export-excel'

export interface ActivityExportRow {
  Data: string
  Tipo: string
  Descrição: string
  'Cliente/Contexto': string
  [key: string]: unknown
}

interface ActivityExportButtonProps {
  rows: ActivityExportRow[]
}

export default function ActivityExportButton({ rows }: ActivityExportButtonProps) {
  function handleExport() {
    exportToExcel('atividades', rows, 'Atividades')
  }

  return (
    <button
      onClick={handleExport}
      disabled={rows.length === 0}
      className="flex items-center gap-1.5 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-xs transition-colors whitespace-nowrap"
    >
      <Download size={13} />
      Exportar Excel
    </button>
  )
}
