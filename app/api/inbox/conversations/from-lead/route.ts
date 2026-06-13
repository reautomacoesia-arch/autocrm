import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Abre (ou cria) a conversa de WhatsApp do inbox para um lead.
 * Usado pelo botão "WhatsApp" no card do lead, que passa a direcionar para o
 * inbox interno em vez de abrir o wa.me externo.
 *
 * Busca: 1) por lead_id; 2) por telefone (contact_handle terminando nos últimos
 * dígitos, p/ tolerar código de país). Se achar por telefone sem lead vinculado,
 * vincula ao lead. Se não achar nada, cria a conversa.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let leadId: string | null = null
  try {
    const body = await request.json()
    leadId = typeof body?.leadId === 'string' ? body.leadId : null
  } catch {
    leadId = null
  }
  if (!leadId) return NextResponse.json({ error: 'leadId obrigatório' }, { status: 400 })

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, name, phone')
    .eq('id', leadId)
    .single()
  if (leadError || !lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  const digits = (lead.phone ?? '').replace(/\D/g, '')

  // 1. conversa já vinculada ao lead
  const { data: byLead } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('channel', 'whatsapp')
    .eq('lead_id', leadId)
    .limit(1)
    .maybeSingle()
  if (byLead) return NextResponse.json(byLead)

  // 2. conversa existente pelo telefone (tolera código de país comparando o final)
  if (digits.length >= 8) {
    const tail = digits.slice(-8)
    const { data: byPhone } = await supabase
      .from('inbox_conversations')
      .select('*')
      .eq('channel', 'whatsapp')
      .ilike('contact_handle', `%${tail}`)
      .limit(1)
    const existing = byPhone?.[0]
    if (existing) {
      if (!existing.lead_id) {
        await supabase.from('inbox_conversations').update({ lead_id: leadId }).eq('id', existing.id)
        existing.lead_id = leadId
      }
      return NextResponse.json(existing)
    }
  }

  // 3. cria a conversa vinculada ao lead
  const { data: created, error: createError } = await supabase
    .from('inbox_conversations')
    .insert({
      channel: 'whatsapp',
      contact_name: lead.name,
      contact_handle: digits || null,
      lead_id: leadId,
    })
    .select()
    .single()

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })
  return NextResponse.json(created, { status: 201 })
}
