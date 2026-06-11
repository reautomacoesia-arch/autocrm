import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data: conversation, error: fetchError } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !conversation) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert({
      name: conversation.contact_name,
      source: conversation.channel,
      phone: conversation.channel === 'whatsapp' ? conversation.contact_handle : null,
      instagram: conversation.channel === 'instagram' ? conversation.contact_handle : null,
    })
    .select()
    .single()

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 })

  const { data: updatedConversation, error: updateError } = await supabase
    .from('inbox_conversations')
    .update({ lead_id: lead.id })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ lead, conversation: updatedConversation }, { status: 201 })
}
