import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/api/rate-limit'
import { scoreLead } from '@/lib/ai-lead-score'
import { STAGE_LABELS, formatCurrency } from '@/lib/pipeline'
import { SOURCE_LABELS } from '@/lib/types'
import type { Lead, InboxConversation, InboxMessage } from '@/lib/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, 'lead-score', { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const supabase = await createClient()
  const { id } = await params

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()
  if (leadError || !lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  const leadData = lead as Lead

  const { data: conversations } = await supabase
    .from('inbox_conversations')
    .select('id')
    .eq('lead_id', id)
    .order('last_message_at', { ascending: false })

  let recentMessages: InboxMessage[] = []
  const conversationIds = ((conversations ?? []) as Pick<InboxConversation, 'id'>[]).map((c) => c.id)
  if (conversationIds.length > 0) {
    const { data: messages } = await supabase
      .from('inbox_messages')
      .select('direction, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(10)
    recentMessages = (messages ?? []) as InboxMessage[]
  }

  const lines: string[] = []
  lines.push(`Lead: ${leadData.name}${leadData.company ? ` (${leadData.company})` : ''}`)
  lines.push(`Estágio no pipeline: ${(STAGE_LABELS as Record<string, string>)[leadData.stage] ?? leadData.stage}`)
  if (leadData.estimated_value > 0) lines.push(`Valor estimado: ${formatCurrency(leadData.estimated_value)}`)
  if (leadData.source) lines.push(`Origem: ${SOURCE_LABELS[leadData.source] ?? leadData.source}`)
  if (leadData.next_step) lines.push(`Próximo passo definido: ${leadData.next_step}`)
  else lines.push('Próximo passo definido: nenhum')
  if (leadData.notes) lines.push(`Notas: ${leadData.notes}`)
  lines.push(`Criado em: ${new Date(leadData.created_at).toLocaleDateString('pt-BR')}`)
  lines.push(`Atualizado em: ${new Date(leadData.updated_at).toLocaleDateString('pt-BR')}`)

  lines.push('')
  lines.push('Últimas mensagens na inbox:')
  if (recentMessages.length > 0) {
    for (const m of recentMessages.slice().reverse()) {
      const date = new Date(m.created_at).toLocaleDateString('pt-BR')
      const direction = m.direction === 'inbound' ? 'Cliente' : 'Equipe'
      lines.push(`- [${date}] ${direction}: ${m.content ?? '(anexo)'}`)
    }
  } else {
    lines.push('- Nenhuma')
  }

  try {
    const { score, reasoning } = await scoreLead(lines.join('\n'))

    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update({
        score,
        score_reason: reasoning,
        scored_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao pontuar lead'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
