import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { proposalCreateSchema } from '@/lib/api/schemas'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('proposals')
    .select('*, clients(id, name, company), leads(id, name, company)')
    .order('created_at', { ascending: false })

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const parsed = await parseBody(request, proposalCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      client_id: body.client_id ?? null,
      lead_id: body.lead_id ?? null,
      value: body.value ?? 0,
      status: 'draft',
      valid_until: body.valid_until ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
