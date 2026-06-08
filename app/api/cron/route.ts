/**
 * Vercel Cron endpoint — runs daily at 12:00 UTC (09:00 BRT).
 * Uses admin client to bypass RLS (no user session in cron context).
 * Protected by CRON_SECRET env var (Vercel adds it automatically to cron requests).
 *
 * Local test:
 *   curl -X GET http://localhost:3000/api/cron \
 *     -H "Authorization: Bearer YOUR_CRON_SECRET"
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── helpers ────────────────────────────────────────────────────────────────────

async function upsertNotification(
  supabase: ReturnType<typeof createAdminClient>,
  key: string,
  title: string,
  body: string | null,
  link: string | null,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('key', key)
    .maybeSingle()

  if (existing) return false

  const { error } = await supabase
    .from('notifications')
    .insert({ key, title, body, link, read: false })

  return !error
}

async function taskAlreadyCreatedToday(
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string | null,
  title: string,
): Promise<boolean> {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString()
  let query = supabase
    .from('tasks')
    .select('id')
    .eq('title', title)
    .gte('created_at', yesterday)
    .limit(1)

  if (clientId) query = query.eq('client_id', clientId)

  const { data } = await query
  return (data?.length ?? 0) > 0
}

// ── main handler ───────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // 1. Auth check
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  let notified = 0
  let tasksCreated = 0
  let emailsSent = 0

  // ── 2. Tarefas em atraso ─────────────────────────────────────────────────────
  const { data: cfg1 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'task_overdue')
    .maybeSingle()

  if (cfg1?.enabled) {
    const days = (cfg1.config?.days_threshold as number) ?? 1
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]

    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('id, title')
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lte('due_date', cutoff)

    const overdueList: string[] = []

    for (const task of overdueTasks ?? []) {
      if (cfg1.config?.notify) {
        const fired = await upsertNotification(
          supabase,
          `task_overdue:${task.id}`,
          `⚠ Tarefa em atraso: ${task.title}`,
          null,
          '/tasks',
        )
        if (fired) {
          notified++
          overdueList.push(task.title)
        }
      }
    }

    // E-mail resumo — enviado 1x (somente para itens que dispararam notificação nova)
    if (cfg1.config?.send_email && overdueList.length > 0) {
      const sent = await sendEmail(
        `🔴 ${overdueList.length} tarefa${overdueList.length !== 1 ? 's' : ''} em atraso`,
        [
          `As seguintes tarefas estão em atraso há ${days}+ dia${days !== 1 ? 's' : ''}:`,
          ...overdueList.map(t => `• ${t}`),
        ],
        'Ver tarefas',
        '/tasks',
      )
      if (sent) emailsSent++
    }
  }

  // ── 3. Propostas sem resposta ─────────────────────────────────────────────────
  const { data: cfg2 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'proposal_no_response')
    .maybeSingle()

  if (cfg2?.enabled) {
    const days = (cfg2.config?.days_threshold as number) ?? 7
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()

    const { data: staleProposals } = await supabase
      .from('proposals')
      .select('id, client_id, lead_id, clients(name), leads(name)')
      .eq('status', 'sent')
      .lte('updated_at', cutoff)

    const staleList: string[] = []

    for (const p of staleProposals ?? []) {
      const clientName =
        (p as any).clients?.name ?? (p as any).leads?.name ?? 'Cliente desconhecido'

      if (cfg2.config?.create_task) {
        const taskTitle = (cfg2.config?.task_title as string) ?? 'Follow-up: proposta sem resposta'
        const alreadyCreated = await taskAlreadyCreatedToday(supabase, p.client_id, taskTitle)
        if (!alreadyCreated) {
          await supabase.from('tasks').insert({
            client_id: p.client_id ?? null,
            lead_id: p.lead_id ?? null,
            title: taskTitle,
            priority: (cfg2.config?.task_priority as string) ?? 'medium',
            status: 'pending',
          })
          tasksCreated++
        }
      }

      if (cfg2.config?.notify) {
        const fired = await upsertNotification(
          supabase,
          `proposal_no_response:${p.id}`,
          `📋 Proposta sem resposta há ${days}+ dias`,
          null,
          `/proposals/${p.id}`,
        )
        if (fired) {
          notified++
          staleList.push(`${clientName} — sem resposta há ${days}+ dias`)
        }
      }
    }

    if (cfg2.config?.send_email && staleList.length > 0) {
      const sent = await sendEmail(
        `⏰ ${staleList.length} proposta${staleList.length !== 1 ? 's' : ''} aguardando resposta`,
        [
          `As seguintes propostas foram enviadas e não tiveram resposta:`,
          ...staleList.map(s => `• ${s}`),
        ],
        'Ver propostas',
        '/proposals',
      )
      if (sent) emailsSent++
    }
  }

  // ── 4. Clientes sem contato ───────────────────────────────────────────────────
  const { data: cfg3 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'client_no_contact')
    .maybeSingle()

  if (cfg3?.enabled) {
    const days = (cfg3.config?.days_threshold as number) ?? 30
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    const month = new Date().toISOString().substring(0, 7)

    const { data: activeClients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'active')

    const noContactList: string[] = []

    for (const client of activeClients ?? []) {
      const { data: lastInteraction } = await supabase
        .from('interactions')
        .select('happened_at')
        .eq('client_id', client.id)
        .order('happened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastInteraction?.happened_at && lastInteraction.happened_at >= cutoff) continue

      if (cfg3.config?.create_task) {
        const taskTitle = (cfg3.config?.task_title as string) ?? 'Retomar contato com cliente'
        const alreadyCreated = await taskAlreadyCreatedToday(supabase, client.id, taskTitle)
        if (!alreadyCreated) {
          await supabase.from('tasks').insert({
            client_id: client.id,
            title: taskTitle,
            priority: (cfg3.config?.task_priority as string) ?? 'medium',
            status: 'pending',
          })
          tasksCreated++
        }
      }

      if (cfg3.config?.notify) {
        const fired = await upsertNotification(
          supabase,
          `client_no_contact:${client.id}:${month}`,
          `🔔 Sem contato: ${client.name}`,
          `Último contato há mais de ${days} dias`,
          `/clients/${client.id}`,
        )
        if (fired) {
          notified++
          noContactList.push(`${client.name} — sem contato há ${days}+ dias`)
        }
      }
    }

    if (cfg3.config?.send_email && noContactList.length > 0) {
      const sent = await sendEmail(
        `🔕 ${noContactList.length} cliente${noContactList.length !== 1 ? 's' : ''} sem contato recente`,
        [
          `Os seguintes clientes não tiveram interação registrada nos últimos ${days} dias:`,
          ...noContactList.map(c => `• ${c}`),
        ],
        'Ver clientes',
        '/clients',
      )
      if (sent) emailsSent++
    }
  }

  // ── 5. Recorrência financeira ─────────────────────────────────────────────────
  const todayDate = new Date()
  const todayDay = todayDate.getDate()
  const currentMonth = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = todayDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const { data: recurringClients } = await supabase
    .from('clients')
    .select('id, name, monthly_value, billing_day')
    .eq('status', 'active')
    .not('billing_day', 'is', null)
    .gt('monthly_value', 0)

  let billingGenerated = 0

  for (const client of recurringClients ?? []) {
    const billingDay = client.billing_day as number
    if (todayDay < billingDay) continue

    const recurringKey = `recurring:${client.id}:${currentMonth}`

    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('recurring_key', recurringKey)
      .maybeSingle()

    if (existing) continue

    const billingDate = `${currentMonth}-${String(billingDay).padStart(2, '0')}`

    const { error: insertErr } = await supabase.from('transactions').insert({
      client_id: client.id,
      amount: client.monthly_value,
      type: 'pending',
      date: billingDate,
      description: `Mensalidade ${monthLabel}`,
      recurring_key: recurringKey,
    })

    if (!insertErr) {
      billingGenerated++
      await upsertNotification(
        supabase,
        `billing_generated:${client.id}:${currentMonth}`,
        `💰 Cobrança gerada: ${client.name}`,
        `Mensalidade ${monthLabel} — ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.monthly_value as number)}`,
        '/financial',
      )
    }
  }

  console.log(
    `[cron] notified=${notified} tasksCreated=${tasksCreated} ` +
    `billingGenerated=${billingGenerated} emailsSent=${emailsSent}`,
  )

  return NextResponse.json({
    success: true,
    notified,
    tasksCreated,
    billingGenerated,
    emailsSent,
    timestamp: new Date().toISOString(),
  })
}
