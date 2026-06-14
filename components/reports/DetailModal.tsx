'use client'

import Modal from '@/components/ui/Modal'

export interface DetailColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export interface DetailModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  columns: DetailColumn[]
  rows: Record<string, React.ReactNode>[]
  emptyMessage?: string
}

export default function DetailModal({
  isOpen, onClose, title, subtitle, columns, rows, emptyMessage = 'Nenhum registro encontrado.',
}: DetailModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      {subtitle && <p className="text-slate-500 text-xs mb-3">{subtitle}</p>}

      {rows.length === 0 ? (
        <div className="py-8 text-center text-slate-600 text-sm">{emptyMessage}</div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`text-xs font-medium text-slate-500 pb-2 pr-3 sticky top-0 bg-[#1a1a1d] ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-800 last:border-0">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-2 pr-3 text-slate-300 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-slate-600 text-xs mt-4 pt-3 border-t border-slate-800">
        {rows.length} registro{rows.length !== 1 ? 's' : ''}
      </p>
    </Modal>
  )
}
