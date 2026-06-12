/**
 * Webhook da UAZAPI — recebe mensagens do WhatsApp.
 *
 * Configure no painel da UAZAPI o webhook de "Mensagens Recebidas" como:
 *   https://SEU_DOMINIO/api/webhooks/whatsapp?secret=WHATSAPP_WEBHOOK_SECRET
 *
 * Variáveis de ambiente necessárias: WHATSAPP_WEBHOOK_SECRET (ver lib/uazapi.ts e lib/ai-sdr.ts
 * para as demais variáveis usadas pelo agente de IA e pelo envio de respostas).
 *
 * Observação: o formato exato do payload pode variar por versão da UAZAPI. O schema
 * (whatsappWebhookSchema) é "loose" e a extração abaixo tenta os campos mais comuns
 * (message.text/content, message.sender/chatid). Ajuste conforme o payload real recebido.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { whatsappWebhookSchema } from '@/lib/api/schemas'
import { rateLimit } from '@/lib/api/rate-limit'
import { sendWhatsAppText } from '@/lib/uazapi'
import { DEFAULT_SDR_SYSTEM_PROMPT, generateSdrReply, type SdrHistoryMessage } from '@/lib/ai-sdr'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const limited = rateLimit(request, 'whatsapp-webhook', { limit: 120, windowMs: 60_000 })
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET
  if (!expectedSecret || searchParams.get('secret') !== expectedSecret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const parsed = await parseBody(request, whatsappWebhookSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const message = body.message
  if (!message) return NextResponse.json({ ok: true })

  // Ignora mensagens enviadas por nós mesmos (eco do próprio número conectado) e de grupos
  if (message.fromMe || message.isGroup) return NextResponse.json({ ok: true })

  const rawId = message.sender || message.chatid || ''
  const phone = rawId.split('@')[0]
  if (!phone) return NextResponse.json({ ok: true })

  const messageText = message.text ?? message.content ?? null
  const senderName = message.senderName || message.pushName || phone

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('channel', 'whatsapp')
    .eq('contact_handle', phone)
    .maybeSingle()

  let conversation = existing
  if (!conversation) {
    const { data: created, error: createError } = await supabase
      .from('inbox_conversations')
      .insert({
        channel: 'whatsapp',
        contact_name: senderName,
        contact_handle: phone,
      })
      .select()
      .single()

    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 })
    conversation = created
  }

  const { error: msgError } = await supabase.from('inbox_messages').insert({
    conversation_id: conversation.id,
    direction: 'inbound',
    content: messageText ?? '[Anexo recebido]',
  })
  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 })

  if (conversation.assigned_to) {
    await supabase.from('notifications').insert({
      title: `Nova mensagem de ${conversation.contact_name}`,
      body: messageText ?? '[Anexo]',
      link: `/inbox?conversation=${conversation.id}`,
    })
  }

  // ── Agente de IA (SDR virtual) ──────────────────────────────────────────
  if (conversation.ai_enabled && messageText) {
    const { data: aiConfig } = await supabase
      .from('automation_configs')
      .select('*')
      .eq('automation_key', 'ai_sdr')
      .maybeSingle()

    if (aiConfig?.enabled) {
      const config = (aiConfig.config as Record<string, unknown>) ?? {}
      const systemPrompt = typeof config.system_prompt === 'string' && config.system_prompt
        ? config.system_prompt
        : DEFAULT_SDR_SYSTEM_PROMPT

      const { data: pastMessages } = await supabase
        .from('inbox_messages')
        .select('direction, content')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(30)

      const history: SdrHistoryMessage[] = (pastMessages ?? [])
        .filter((m) => m.content)
        .map((m) => ({
          role: m.direction === 'inbound' ? 'user' : 'assistant',
          content: m.content as string,
        }))

      const result = await generateSdrReply(history, systemPrompt)

      if (result.reply) {
        await supabase.from('inbox_messages').insert({
          conversation_id: conversation.id,
          direction: 'outbound',
          content: result.reply,
          is_ai: true,
        })
        await sendWhatsAppText(phone, result.reply)
      }

      if (result.lead && !conversation.lead_id) {
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .insert({
            name: result.lead.name,
            company: result.lead.company ?? null,
            email: result.lead.email ?? null,
            phone,
            estimated_value: result.lead.estimated_value ?? 0,
            notes: result.lead.notes,
            source: 'whatsapp',
          })
          .select()
          .single()

        if (!leadError && lead) {
          await supabase.from('inbox_conversations').update({ lead_id: lead.id }).eq('id', conversation.id)

          if (config.notify !== false) {
            await supabase.from('notifications').insert({
              title: `Novo lead via WhatsApp: ${lead.name}`,
              body: result.lead.notes,
              link: '/pipeline',
            })
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
