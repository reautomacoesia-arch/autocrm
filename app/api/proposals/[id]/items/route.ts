import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

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
  const body = await request.json()

  const { error } = await supabase
    .from('proposal_items')
    .delete()
    .eq('id', body.item_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
