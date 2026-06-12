import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { taskUpdateSchema } from '@/lib/api/schemas'

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

  // Busca status atual antes de atualizar (para detectar mudança real)
  let previousStatus: string | null = null
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('tasks')
      .select('status, client_id, title')
      .eq('id', id)
      .single()
    previousStatus = current?.status ?? null

    // Se status realmente mudou e tarefa tem cliente, registra no histórico
    if (current && current.client_id && current.status !== body.status) {
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

  const { data, error } = await supabase
    .from('tasks')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
