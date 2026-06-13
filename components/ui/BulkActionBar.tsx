'use client'

import { CheckSquare, X } from 'lucide-react'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  children: React.ReactNode
}

/**
 * Barra de ações em massa. Renderiza null quando `count === 0`.
 * Posicionar no topo da lista, dentro do fluxo (mb-3).
 */
export default function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div className="mb-3 bg-[#1a1a1d] border border-[#d4af37] rounded-lg px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2.5">
        <CheckSquare size={15} className="text-[#d4af37]" />
        <span className="text-sm text-white font-medium">
          {count} selecionado{count !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={12} />
          limpar
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  )
}
