import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('inbox_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if (!body.direction || (!body.content && !body.attachment_r2_key)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const { data: message, error } = await supabase
    .from('inbox_messages')
    .insert({
      conversation_id: id,
      direction: body.direction,
      content: body.content ?? null,
      attachment_r2_key: body.attachment_r2_key ?? null,
      attachment_name: body.attachment_name ?? null,
      attachment_mime_type: body.attachment_mime_type ?? null,
      attachment_size: body.attachment_size ?? null,
      sender_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.direction === 'inbound') {
    const { data: conversation } = await supabase
      .from('inbox_conversations')
      .select('contact_name, assigned_to')
      .eq('id', id)
      .single()

    if (conversation?.assigned_to) {
      await supabase.from('notifications').insert({
        title: `Nova mensagem de ${conversation.contact_name}`,
        body: message.content ?? '[Anexo]',
        link: `/inbox?conversation=${id}`,
      })
    }
  }

  return NextResponse.json(message, { status: 201 })
}
