'use client'

import { useCallback, useMemo, useState } from 'react'

export interface UseBulkSelectionResult {
  selected: Set<string>
  count: number
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleAll: (ids: string[]) => void
  allSelected: (ids: string[]) => boolean
  clear: () => void
}

/**
 * Gerencia um conjunto de ids selecionados para ações em massa.
 * - `toggle(id)`: alterna a seleção de um item.
 * - `toggleAll(ids)`: se todos os `ids` já estão selecionados, remove-os;
 *   senão, adiciona todos os `ids` à seleção.
 * - `allSelected(ids)`: true se todos os `ids` (não vazio) estão selecionados.
 */
export function useBulkSelection(): UseBulkSelectionResult {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const allIn = ids.length > 0 && ids.every((id) => prev.has(id))
      if (allIn) {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSelected(new Set())
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  const allSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected],
  )

  const count = useMemo(() => selected.size, [selected])

  return { selected, count, isSelected, toggle, toggleAll, allSelected, clear }
}

/**
 * Executa `fn` para cada `id` em paralelo (best-effort) e retorna a contagem
 * de sucessos/falhas. Uma falha é uma rejeição da promise OU uma `Response`
 * com `ok === false`.
 */
export async function bulkRun<T>(ids: T[], fn: (id: T) => Promise<unknown>): Promise<{ ok: number; fail: number }> {
  const results = await Promise.allSettled(ids.map(fn))
  const fail = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as Response | undefined)?.ok === false)).length
  return { ok: ids.length - fail, fail }
}
