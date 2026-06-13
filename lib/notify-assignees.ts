import type { createClient } from '@/lib/supabase/server'

/**
 * Notifica os responsáveis (deduplicados, exceto o usuário logado) que foram
 * atribuídos a uma tarefa. Best-effort: erros são silenciados para não
 * derrubar a resposta principal da rota chamadora.
 */
export async function notifyAssignees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { taskTitle, assigneeIds, currentUserId }: {
    taskTitle: string
    assigneeIds: (string | null | undefined)[]
    currentUserId: string | undefined
  }
): Promise<void> {
  try {
    const ids = Array.from(new Set(assigneeIds.filter((id): id is string => !!id)))
      .filter((id) => id !== currentUserId)

    if (ids.length === 0) return

    await supabase.from('notifications').insert(
      ids.map((userId) => ({
        user_id: userId,
        title: `Você foi atribuído à tarefa: ${taskTitle}`,
        body: null,
        link: '/tasks',
      }))
    )
  } catch {
    // best-effort: não derruba a resposta principal
  }
}
