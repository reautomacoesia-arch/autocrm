import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/api/rate-limit'
import { generateClientSummary } from '@/lib/ai-summary'
import { formatCurrency } from '@/lib/pipeline'
import type { Interaction, Task, Proposal, InboxConversation, InboxMessage } from '@/lib/types'

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  note: 'Nota',
  meeting: 'Reunião',
  email: 'E-mail',
  task_update: 'Atualização de tarefa',
}

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'pendente',
  in_progress: 'em andamento',
  done: 'concluída',
}

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: 'rascunho',
  sent: 'enviada',
  approved: 'aprovada',
  rejected: 'rejeitada',
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, 'client-summary', { limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const supabase = await createClient()
  const { id } = await params

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('name, company, status, monthly_value, started_at')
    .eq('id', id)
    .single()
  if (clientError || !client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const [{ data: interactions }, { data: tasks }, { data: proposals }, { data: conversations }] = await Promise.all([
    supabase
      .from('interactions')
      .select('type, description, happened_at')
      .eq('client_id', id)
      .order('happened_at', { ascending: false })
      .limit(8),
    supabase
      .from('tasks')
      .select('title, status, priority, due_date')
      .eq('client_id', id)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
      .limit(8),
    supabase
      .from('proposals')
      .select('value, status, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('inbox_conversations')
      .select('id, channel, status, last_message_at')
      .eq('client_id', id)
      .order('last_message_at', { ascending: false })
      .limit(2),
  ])

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
  lines.push(`Cliente: ${client.name}${client.company ? ` (${client.company})` : ''}`)
  lines.push(`Status: ${client.status}`)
  if (client.monthly_value > 0) lines.push(`Mensalidade: ${formatCurrency(client.monthly_value)}`)
  if (client.started_at) lines.push(`Cliente desde: ${client.started_at}`)

  lines.push('')
  lines.push('Interações recentes:')
  if (interactions && interactions.length > 0) {
    for (const i of interactions as Pick<Interaction, 'type' | 'description' | 'happened_at'>[]) {
      const date = new Date(i.happened_at).toLocaleDateString('pt-BR')
      lines.push(`- [${date}] ${INTERACTION_TYPE_LABELS[i.type] ?? i.type}: ${i.description ?? ''}`)
    }
  } else {
    lines.push('- Nenhuma registrada')
  }

  lines.push('')
  lines.push('Tarefas em aberto:')
  if (tasks && tasks.length > 0) {
    for (const t of tasks as Pick<Task, 'title' | 'status' | 'priority' | 'due_date'>[]) {
      const due = t.due_date ? ` (prazo: ${t.due_date})` : ''
      lines.push(`- ${t.title} — ${TASK_STATUS_LABELS[t.status] ?? t.status}, prioridade ${t.priority}${due}`)
    }
  } else {
    lines.push('- Nenhuma')
  }

  lines.push('')
  lines.push('Propostas:')
  if (proposals && proposals.length > 0) {
    for (const p of proposals as Pick<Proposal, 'value' | 'status' | 'created_at'>[]) {
      const date = new Date(p.created_at).toLocaleDateString('pt-BR')
      lines.push(`- [${date}] ${formatCurrency(p.value)} — ${PROPOSAL_STATUS_LABELS[p.status] ?? p.status}`)
    }
  } else {
    lines.push('- Nenhuma')
  }

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
    const summary = await generateClientSummary(lines.join('\n'))
    return NextResponse.json({ summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar resumo'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
