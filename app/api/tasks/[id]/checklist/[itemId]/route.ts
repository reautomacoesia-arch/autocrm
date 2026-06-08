import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const supabase = await createClient()
  const { itemId } = await params
  const body = await request.json()

  const fields: Record<string, unknown> = {}
  if (body.done !== undefined) fields.done = body.done
  if (body.text !== undefined) fields.text = body.text

  const { data, error } = await supabase
    .from('task_checklist_items')
    .update(fields)
    .eq('id', itemId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const supabase = await createClient()
  const { itemId } = await params

  const { error } = await supabase.from('task_checklist_items').delete().eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
