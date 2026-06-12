import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { proposalItemCreateSchema, proposalItemDeleteSchema } from '@/lib/api/schemas'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, proposalItemCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('proposal_items')
    .insert({
      proposal_id: id,
      service_id: body.service_id ?? null,
      custom_description: body.custom_description ?? null,
      price: body.price,
    })
    .select('*, services(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  await params
  const parsed = await parseBody(request, proposalItemDeleteSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { error } = await supabase
    .from('proposal_items')
    .delete()
    .eq('id', body.item_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
