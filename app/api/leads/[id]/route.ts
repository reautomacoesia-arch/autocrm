import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAutomation } from '@/lib/automation-engine'
import { runWorkflows } from '@/lib/workflow-engine'
import { parseBody } from '@/lib/api/validation'
import { leadUpdateSchema } from '@/lib/api/schemas'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, leadUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // Read previous state to detect stage change
  const { data: prev } = await supabase
    .from('leads')
    .select('stage, name')
    .eq('id', id)
    .single()

  // Build update object with only the fields present in the body
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined)             fields.name = body.name
  if (body.company !== undefined)          fields.company = body.company ?? null
  if (body.email !== undefined)            fields.email = body.email ?? null
  if (body.phone !== undefined)            fields.phone = body.phone ?? null
  if (body.estimated_value !== undefined)  fields.estimated_value = body.estimated_value ?? 0
  if (body.stage !== undefined)            fields.stage = body.stage
  if (body.notes !== undefined)            fields.notes = body.notes ?? null
  if (body.instagram !== undefined)        fields.instagram = body.instagram ?? null
  if (body.website !== undefined)          fields.website = body.website ?? null
  if (body.source !== undefined)           fields.source = body.source ?? null
  if (body.next_step !== undefined)        fields.next_step = body.next_step ?? null

  const { data, error } = await supabase
    .from('leads')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log pipeline stage change + fire automations (fire-and-forget)
  if (body.stage && prev?.stage && prev.stage !== body.stage) {
    const leadName = data?.name ?? prev?.name ?? 'Lead'
    void supabase.from('pipeline_events').insert({
      lead_id: id,
      lead_name: leadName,
      from_stage: prev.stage,
      to_stage: body.stage,
    }).then(() => {}, () => {})
    const context = { leadId: id, leadName }

    // Determina o tipo do estágio destino via pipeline_stages (dinâmico);
    // se a tabela não existir/sem match, cai no fallback pelo slug 'won'/'lost'.
    let stageType: string | null = null
    try {
      const { data: stageRow } = await supabase
        .from('pipeline_stages')
        .select('type')
        .eq('slug', body.stage)
        .maybeSingle()
      stageType = stageRow?.type ?? null
    } catch {
      stageType = null
    }
    if (stageType === null) {
      if (body.stage === 'won') stageType = 'won'
      else if (body.stage === 'lost') stageType = 'lost'
    }

    if (stageType === 'won') {
      void runAutomation(supabase, 'lead_won', { ...context, clientId: body.clientId ?? undefined })
    } else if (stageType === 'lost') {
      void runAutomation(supabase, 'lead_lost', context)
    }
    void runWorkflows(supabase, 'lead.stage_changed', {
      leadId: id,
      leadName,
      fromStage: prev.stage,
      toStage: body.stage,
      estimatedValue: data?.estimated_value ?? undefined,
      source: data?.source ?? undefined,
      phone: data?.phone ?? undefined,
    })
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
