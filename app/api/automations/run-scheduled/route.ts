import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function createTaskLocal(supabase: any, config: any, context: { clientId?: string; leadId?: string }) {
  if (!config?.create_task) return
  await supabase.from('tasks').insert({
    client_id: context.clientId ?? null,
    lead_id: context.leadId ?? null,
    title: config.task_title ?? 'Tarefa automática',
    priority: config.task_priority ?? 'medium',
    status: 'pending',
  })
}

async function createNotifLocal(supabase: any, config: any, title: string, link: string | null) {
  if (!config?.notify) return
  await supabase.from('notifications').insert({ title, body: null, link })
}

export async function POST() {
  const supabase = await createClient()

  // ── proposal_no_response ────────────────────────────────────────────────
  const { data: cfg1 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'proposal_no_response')
    .single()

  if (cfg1?.enabled) {
    const days = (cfg1.config?.days_threshold as number) ?? 7
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, client_id, lead_id, updated_at')
      .eq('status', 'sent')
      .lte('updated_at', cutoff)

    for (const p of proposals ?? []) {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString()
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('client_id', p.client_id)
        .eq('title', cfg1.config?.task_title ?? 'Follow-up: proposta sem resposta')
        .gte('created_at', yesterday)
        .limit(1)

      if (existing && existing.length > 0) continue

      await createTaskLocal(supabase, cfg1.config, { clientId: p.client_id, leadId: p.lead_id })
      await createNotifLocal(supabase, cfg1.config,
        `Proposta sem resposta há ${days} dias`,
        `/proposals/${p.id}`
      )
    }
  }

  // ── lead_no_contact ──────────────────────────────────────────────────────
  const { data: cfgLead } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'lead_no_contact')
    .single()

  if (cfgLead?.enabled) {
    const days = (cfgLead.config?.days_threshold as number) ?? 3
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    const { data: leads } = await supabase
      .from('leads')
      .select('id, name, updated_at')
      .in('stage', ['lead', 'contacted', 'proposal_sent', 'negotiating'])
      .lte('updated_at', cutoff)

    for (const lead of leads ?? []) {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString()
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('title', cfgLead.config?.task_title ?? 'Retomar contato com lead')
        .gte('created_at', yesterday)
        .limit(1)

      if (existing && existing.length > 0) continue

      await createTaskLocal(supabase, cfgLead.config, { leadId: lead.id })
      await createNotifLocal(supabase, cfgLead.config,
        `Sem contato: ${lead.name}`,
        '/pipeline'
      )
    }
  }

  // ── client_no_contact ───────────────────────────────────────────────────
  const { data: cfg2 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'client_no_contact')
    .single()

  if (cfg2?.enabled) {
    const days = (cfg2.config?.days_threshold as number) ?? 30
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'active')

    for (const client of clients ?? []) {
      const { data: lastInteraction } = await supabase
        .from('interactions')
        .select('happened_at')
        .eq('client_id', client.id)
        .order('happened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastDate = lastInteraction?.happened_at ?? null
      if (lastDate && lastDate >= cutoff) continue

      const yesterday = new Date(Date.now() - 86_400_000).toISOString()
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('client_id', client.id)
        .eq('title', cfg2.config?.task_title ?? 'Retomar contato com cliente')
        .gte('created_at', yesterday)
        .limit(1)

      if (existing && existing.length > 0) continue

      await createTaskLocal(supabase, cfg2.config, { clientId: client.id })
      await createNotifLocal(supabase, cfg2.config,
        `Sem contato: ${client.name}`,
        `/clients/${client.id}`
      )
    }
  }

  // ── task_overdue ────────────────────────────────────────────────────────
  const { data: cfg3 } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', 'task_overdue')
    .single()

  if (cfg3?.enabled) {
    const days = (cfg3.config?.days_threshold as number) ?? 1
    const cutoffDate = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title')
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lte('due_date', cutoffDate)

    for (const task of tasks ?? []) {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString()
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .ilike('title', `%${task.title}%`)
        .gte('created_at', yesterday)
        .limit(1)

      if (existing && existing.length > 0) continue

      if (cfg3.config?.notify) {
        await supabase.from('notifications').insert({
          title: `Tarefa em atraso: ${task.title}`,
          body: null,
          link: '/tasks',
        })
      }
    }
  }

  return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
}
