import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const body = await request.json()

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      lead_id: lead.id,
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      monthly_value: body.monthly_value ?? 0,
      status: 'active',
      started_at: new Date().toISOString().split('T')[0],
      referred_by: body.referred_by ?? null,
    })
    .select()
    .single()

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 })
  }

  await supabase
    .from('leads')
    .update({ stage: 'won', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json(client, { status: 201 })
}
