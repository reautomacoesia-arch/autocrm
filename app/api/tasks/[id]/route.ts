import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { taskUpdateSchema } from '@/lib/api/schemas'
import { notifyAssignees } from '@/lib/notify-assignees'

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pendente',
  in_progress: 'Em andamento',
  done:        'Concluída',
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, taskUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined)       fields.title = body.title
  if (body.description !== undefined) fields.description = body.description ?? null
  if (body.status !== undefined)      fields.status = body.status
  if (body.priority !== undefined)    fields.priority = body.priority
  if (body.due_date !== undefined)    fields.due_date = body.due_date ?? null
  if (body.assigned_to !== undefined)     fields.assigned_to = body.assigned_to ?? null
  if (body.assigned_to_id !== undefined)  fields.assigned_to_id = body.assigned_to_id ?? null
  if (body.assigned_to_ids !== undefined) fields.assigned_to_ids = body.assigned_to_ids ?? []
  if (body.tags !== undefined)            fields.tags = body.tags

  // Busca status/responsáveis atuais antes de atualizar (para detectar mudanças reais)
  let previousAssigneeIds: string[] = []
  const needsAssigneeDiff = body.assigned_to_id !== undefined || body.assigned_to_ids !== undefined
  if (body.status !== undefined || needsAssigneeDiff) {
    const { data: current } = await supabase
      .from('tasks')
      .select('status, client_id, title, assigned_to_id, assigned_to_ids')
      .eq('id', id)
      .single()
    previousAssigneeIds = [
      ...(current?.assigned_to_ids ?? []),
      ...(current?.assigned_to_id ? [current.assigned_to_id] : []),
    ]

    // Se o status realmente mudou, registra a conclusão (para medir tempo até concluir) e o histórico
    if (current && body.status !== undefined && current.status !== body.status) {
      fields.completed_at = body.status === 'done' ? new Date().toISOString() : null

      if (current.client_id) {
        const from = STATUS_LABELS[current.status] ?? current.status
        const to   = STATUS_LABELS[body.status]    ?? body.status
        await supabase.from('interactions').insert({
          client_id:    current.client_id,
          type:         'task_update',
          description:  `Tarefa "${current.title}" avançou de ${from} → ${to}`,
          happened_at:  new Date().toISOString(),
        })
      }
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (needsAssigneeDiff) {
    const newAssigneeIds = [
      ...(body.assigned_to_ids ?? []),
      ...(body.assigned_to_id ? [body.assigned_to_id] : []),
    ]
    const addedIds = Array.from(new Set(newAssigneeIds.filter((newId) => newId && !previousAssigneeIds.includes(newId))))
    const { data: { user } } = await supabase.auth.getUser()
    await notifyAssignees(supabase, { taskTitle: data.title, assigneeIds: addedIds, currentUserId: user?.id })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
