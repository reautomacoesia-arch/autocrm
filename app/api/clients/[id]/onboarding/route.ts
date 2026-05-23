import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data } = await supabase
    .from('onboarding')
    .select('*')
    .eq('client_id', id)
    .single()

  return NextResponse.json(data ?? null)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { data: existing } = await supabase
    .from('onboarding')
    .select('id')
    .eq('client_id', id)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('onboarding')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('client_id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } else {
    const { data, error } = await supabase
      .from('onboarding')
      .insert({ client_id: id, ...body })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }
}
