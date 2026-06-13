import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { taskCreateSchema } from '@/lib/api/schemas'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const parsed = await parseBody(request, taskCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? 'medium',
      due_date: body.due_date ?? null,
      status: body.status ?? 'pending',
      client_id: body.client_id ?? null,
      lead_id: body.lead_id ?? null,
      assigned_to: body.assigned_to ?? null,
      assigned_to_id: body.assigned_to_id ?? null,
      assigned_to_ids: body.assigned_to_ids ?? [],
      tags: body.tags ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await notifyAssignees(supabase, data.title, [
    ...(body.assigned_to_ids ?? []),
    ...(body.assigned_to_id ? [body.assigned_to_id] : []),
  ])

  return NextResponse.json(data, { status: 201 })
}

/** Notifica os responsáveis (deduplicados, exceto o usuário logado) que foram atribuídos a uma tarefa. */
async function notifyAssignees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskTitle: string,
  assigneeIds: (string | null | undefined)[]
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const ids = Array.from(new Set(assigneeIds.filter((id): id is string => !!id)))
      .filter((id) => id !== user?.id)

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
