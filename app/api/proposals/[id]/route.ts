import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAutomation } from '@/lib/automation-engine'
import { runWorkflows } from '@/lib/workflow-engine'
import { parseBody } from '@/lib/api/validation'
import { proposalUpdateSchema } from '@/lib/api/schemas'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('proposals')
    .select(`*, clients(id, name, company, email), leads(id, name, company, email), proposal_items(*, services(name))`)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, proposalUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // Read previous status
  const { data: prev } = await supabase
    .from('proposals')
    .select('status, client_id')
    .eq('id', id)
    .single()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updates.status = body.status
  if (body.value !== undefined) updates.value = body.value
  if (body.valid_until !== undefined) updates.valid_until = body.valid_until ?? null
  if (body.notes !== undefined) updates.notes = body.notes ?? null

  const { data, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire automation on approval
  if (body.status === 'approved' && prev?.status !== 'approved') {
    void runAutomation(supabase, 'proposal_approved', {
      proposalId: id,
      clientId: data?.client_id ?? prev?.client_id ?? undefined,
    })
  }

  if (body.status !== undefined && prev?.status !== body.status) {
    void runWorkflows(supabase, 'proposal.status_changed', {
      proposalId: id,
      clientId: data?.client_id ?? undefined,
      leadId: data?.lead_id ?? undefined,
      fromStatus: prev?.status,
      toStatus: body.status,
      value: data?.value ?? undefined,
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

  const { error } = await supabase.from('proposals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
