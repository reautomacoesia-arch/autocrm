import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined)       fields.title = body.title
  if (body.description !== undefined) fields.description = body.description ?? null
  if (body.status !== undefined)      fields.status = body.status
  if (body.priority !== undefined)    fields.priority = body.priority
  if (body.due_date !== undefined)    fields.due_date = body.due_date ?? null
  if (body.assigned_to !== undefined)    fields.assigned_to = body.assigned_to ?? null
  if (body.assigned_to_id !== undefined) fields.assigned_to_id = body.assigned_to_id ?? null
  if (body.tags !== undefined)        fields.tags = body.tags

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
