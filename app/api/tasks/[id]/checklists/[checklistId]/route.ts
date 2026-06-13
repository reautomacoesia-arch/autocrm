import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { taskChecklistUpdateSchema } from '@/lib/api/schemas'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; checklistId: string }> }
) {
  const supabase = await createClient()
  const { id, checklistId } = await params
  const parsed = await parseBody(request, taskChecklistUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const fields: Record<string, unknown> = {}
  if (body.title !== undefined) fields.title = body.title
  if (body.position !== undefined) fields.position = body.position

  const { data, error } = await supabase
    .from('task_checklists')
    .update(fields)
    .eq('id', checklistId)
    .eq('task_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; checklistId: string }> }
) {
  const supabase = await createClient()
  const { id, checklistId } = await params

  const { error } = await supabase
    .from('task_checklists')
    .delete()
    .eq('id', checklistId)
    .eq('task_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
