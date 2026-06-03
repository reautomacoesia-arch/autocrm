import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('leads')
    .insert({
      name: body.name,
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      stage: body.stage ?? 'lead',
      estimated_value: body.estimated_value ?? 0,
      notes: body.notes ?? null,
      source: body.source ?? null,
      next_step: body.next_step ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
