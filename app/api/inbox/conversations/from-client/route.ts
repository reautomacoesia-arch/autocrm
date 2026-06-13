import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { openConversationForEntity } from '@/lib/inbox/open-conversation'

/**
 * Abre (ou cria) a conversa de WhatsApp do inbox para um cliente.
 * Usado pelo botão "WhatsApp" na pasta do cliente, que direciona para o inbox
 * interno em vez de abrir o wa.me externo.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let clientId: string | null = null
  try {
    const body = await request.json()
    clientId = typeof body?.clientId === 'string' ? body.clientId : null
  } catch {
    clientId = null
  }
  if (!clientId) return NextResponse.json({ error: 'clientId obrigatório' }, { status: 400 })

  const result = await openConversationForEntity(supabase, { type: 'client', id: clientId })
  if (result.error === 'not_found') return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  if (result.error || !result.conversation) {
    return NextResponse.json({ error: result.error ?? 'Erro ao abrir conversa' }, { status: 500 })
  }
  return NextResponse.json(result.conversation, { status: result.created ? 201 : 200 })
}
