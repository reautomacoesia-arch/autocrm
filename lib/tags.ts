import type { Task } from './types'

// Tags padrão sugeridas quando ainda não há histórico suficiente de uso.
export const DEFAULT_TAG_SUGGESTIONS = ['urgente', 'cliente', 'reuniao', 'financeiro', 'follow-up', 'proposta']

// Retorna as tags mais usadas nas tarefas existentes, das mais frequentes às menos,
// completando com sugestões padrão até o limite informado.
export function getSuggestedTags(tasks: Task[], limit = 8): string[] {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    for (const tag of t.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  const byFrequency = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)

  const result = [...byFrequency]
  for (const tag of DEFAULT_TAG_SUGGESTIONS) {
    if (result.length >= limit) break
    if (!result.includes(tag)) result.push(tag)
  }

  return result.slice(0, limit)
}
