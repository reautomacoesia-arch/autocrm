import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { workflowUpdateSchema } from '@/lib/api/schemas'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, workflowUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) update.name = body.name
  if (body.trigger_type !== undefined) update.trigger_type = body.trigger_type
  if (body.enabled !== undefined) update.enabled = body.enabled
  if (body.conditions !== undefined) update.conditions = body.conditions
  if (body.actions !== undefined) update.actions = body.actions

  const { data, error } = await supabase
    .from('automation_workflows')
    .update(update)
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

  const { error } = await supabase.from('automation_workflows').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
