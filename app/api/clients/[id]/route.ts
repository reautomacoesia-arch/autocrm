import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runAutomation } from '@/lib/automation-engine'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  // Read previous status
  const { data: prev } = await supabase
    .from('clients')
    .select('status, name')
    .eq('id', id)
    .single()

  const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name          !== undefined) updateFields.name          = body.name
  if (body.company       !== undefined) updateFields.company       = body.company ?? null
  if (body.email         !== undefined) updateFields.email         = body.email ?? null
  if (body.phone         !== undefined) updateFields.phone         = body.phone ?? null
  if (body.monthly_value !== undefined) updateFields.monthly_value = body.monthly_value
  if (body.status        !== undefined) updateFields.status        = body.status
  if (body.instagram     !== undefined) updateFields.instagram     = body.instagram ?? null
  if (body.website       !== undefined) updateFields.website       = body.website ?? null
  if (body.contact_name  !== undefined) updateFields.contact_name  = body.contact_name ?? null
  if (body.is_internal   !== undefined) updateFields.is_internal   = body.is_internal

  const { data, error } = await supabase
    .from('clients')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire automation when client becomes inactive/churned
  if (body.status && ['inactive', 'churned'].includes(body.status) && prev?.status === 'active') {
    void runAutomation(supabase, 'client_churned', {
      clientId: id,
      clientName: data?.name ?? prev?.name,
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

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
