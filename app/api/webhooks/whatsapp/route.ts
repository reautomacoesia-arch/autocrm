/**
 * Webhook do Z-API — recebe mensagens do WhatsApp.
 *
 * Configure no painel da Z-API a URL "Ao receber" (on-message-received) como:
 *   https://SEU_DOMINIO/api/webhooks/whatsapp?secret=WHATSAPP_WEBHOOK_SECRET
 *
 * Variáveis de ambiente necessárias: WHATSAPP_WEBHOOK_SECRET (ver lib/zapi.ts e lib/ai-sdr.ts
 * para as demais variáveis usadas pelo agente de IA e pelo envio de respostas).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { whatsappWebhookSchema } from '@/lib/api/schemas'
import { rateLimit } from '@/lib/api/rate-limit'
import { sendWhatsAppText } from '@/lib/zapi'
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

  // Ignora mensagens enviadas por nós mesmos (eco do próprio número conectado)
  if (body.fromMe) return NextResponse.json({ ok: true })

  const messageText =
    body.text?.message ?? body.image?.caption ?? body.video?.caption ?? body.document?.caption ?? null

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('channel', 'whatsapp')
    .eq('contact_handle', body.phone)
    .maybeSingle()

  let conversation = existing
  if (!conversation) {
    const { data: created, error: createError } = await supabase
      .from('inbox_conversations')
      .insert({
        channel: 'whatsapp',
        contact_name: body.senderName || body.chatName || body.phone,
        contact_handle: body.phone,
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
        await sendWhatsAppText(body.phone, result.reply)
      }

      if (result.lead && !conversation.lead_id) {
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .insert({
            name: result.lead.name,
            company: result.lead.company ?? null,
            email: result.lead.email ?? null,
            phone: body.phone,
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
