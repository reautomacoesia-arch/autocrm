import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const channel = searchParams.get('channel')
  const assignedTo = searchParams.get('assigned_to')
  const rawSearch = searchParams.get('search')
  const search = rawSearch ? rawSearch.replace(/[,()\"]/g, '') : null

  let query = supabase
    .from('inbox_conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (channel) query = query.eq('channel', channel)
  if (assignedTo === 'me') query = query.eq('assigned_to', user.id)
  if (search) query = query.or(`contact_name.ilike.%${search}%,contact_handle.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()

  if (!body.channel || !body.contact_name) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('inbox_conversations')
    .insert({
      channel: body.channel,
      contact_name: body.contact_name,
      contact_handle: body.contact_handle ?? null,
      lead_id: body.lead_id ?? null,
      client_id: body.client_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
