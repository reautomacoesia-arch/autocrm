import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { expenseUpdateSchema } from '@/lib/api/schemas'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, expenseUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.description !== undefined) update.description = body.description
  if (body.amount !== undefined) update.amount = body.amount
  if (body.category !== undefined) update.category = body.category ?? null
  if (body.date !== undefined) update.date = body.date
  if (body.recurring !== undefined) update.recurring = body.recurring
  if (body.recurring_day !== undefined) update.recurring_day = body.recurring_day ?? null
  if (body.client_id !== undefined) update.client_id = body.client_id ?? null

  const { data, error } = await supabase
    .from('expenses')
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

  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
