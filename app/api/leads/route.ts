import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { leadCreateSchema } from '@/lib/api/schemas'

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
  const parsed = await parseBody(request, leadCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

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

  // Registra a criação no histórico de atividades (from_stage 'new' = lead criado)
  if (data) {
    void supabase.from('pipeline_events').insert({
      lead_id: data.id,
      lead_name: data.name,
      from_stage: 'new',
      to_stage: data.stage,
    }).then(() => {}, () => {})
  }

  return NextResponse.json(data, { status: 201 })
}
