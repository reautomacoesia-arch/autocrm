import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAutomation } from '@/lib/automation-engine'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  // Read previous state to detect stage change
  const { data: prev } = await supabase
    .from('leads')
    .select('stage, name')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('leads')
    .update({
      name: body.name,
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      estimated_value: body.estimated_value ?? 0,
      stage: body.stage,
      notes: body.notes ?? null,
      instagram: body.instagram ?? null,
      website: body.website ?? null,
      source: body.source ?? null,
      next_step: body.next_step ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire automations on stage change (fire-and-forget)
  if (body.stage && prev?.stage !== body.stage) {
    const context = { leadId: id, leadName: data?.name ?? prev?.name }
    if (body.stage === 'won') {
      void runAutomation(supabase, 'lead_won', { ...context, clientId: body.clientId })
    } else if (body.stage === 'lost') {
      void runAutomation(supabase, 'lead_lost', context)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
