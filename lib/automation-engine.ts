import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

export interface AutomationContext {
  leadId?: string
  clientId?: string
  proposalId?: string
  taskId?: string
  leadName?: string
  clientName?: string
  clientEmail?: string
}

type Config = Record<string, unknown>

async function createTask(
  supabase: SupabaseClient,
  config: Config,
  context: AutomationContext
): Promise<void> {
  if (!config.create_task) return
  await supabase.from('tasks').insert({
    client_id: context.clientId ?? null,
    lead_id: context.leadId ?? null,
    title: (config.task_title as string) ?? 'Tarefa automática',
    priority: (config.task_priority as string) ?? 'medium',
    status: 'pending',
  })
}

async function createTransaction(
  supabase: SupabaseClient,
  config: Config,
  context: AutomationContext
): Promise<void> {
  if (!config.create_transaction || !context.clientId) return
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  await supabase.from('transactions').insert({
    client_id: context.clientId,
    amount: (config.transaction_amount as number) ?? 0,
    type: 'pending',
    date,
    description: 'Transação criada automaticamente',
  })
}

async function createNote(
  supabase: SupabaseClient,
  config: Config,
  context: AutomationContext
): Promise<void> {
  if (!config.create_note || !context.clientId) return
  await supabase.from('interactions').insert({
    client_id: context.clientId,
    type: 'note',
    description: (config.note_text as string) ?? 'Interação automática',
    happened_at: new Date().toISOString(),
  })
}

async function createNotification(
  supabase: SupabaseClient,
  config: Config,
  title: string,
  body: string | null,
  link: string | null
): Promise<void> {
  if (!config.notify) return
  await supabase.from('notifications').insert({ title, body, link })
}

export async function runAutomation(
  supabase: SupabaseClient,
  key: string,
  context: AutomationContext
): Promise<void> {
  const { data: cfg } = await supabase
    .from('automation_configs')
    .select('*')
    .eq('automation_key', key)
    .single()

  if (!cfg || !cfg.enabled) return

  const config: Config = (cfg.config as Config) ?? {}

  switch (key) {
    case 'lead_won': {
      await createTask(supabase, config, context)
      await createTransaction(supabase, config, context)
      await createNotification(
        supabase, config,
        `Lead convertido: ${context.leadName ?? 'novo cliente'}`,
        'Um lead foi convertido em cliente.',
        context.clientId ? `/clients/${context.clientId}` : '/clients'
      )
      if (config.send_email) {
        await sendEmail(
          `🏆 Novo cliente: ${context.leadName ?? 'Lead convertido'}`,
          [
            `O lead <strong style="color:#f8fafc">${context.leadName ?? 'desconhecido'}</strong> foi convertido em cliente.`,
            config.create_task ? `Tarefa de onboarding criada automaticamente.` : '',
          ],
          'Ver cliente',
          context.clientId ? `/clients/${context.clientId}` : '/clients',
        )
      }
      break
    }

    case 'proposal_approved': {
      await createTask(supabase, config, context)
      await createNotification(
        supabase, config,
        'Proposta aprovada!',
        null,
        context.proposalId ? `/proposals/${context.proposalId}` : '/proposals'
      )
      if (config.send_email) {
        await sendEmail(
          '✅ Proposta aprovada',
          [
            'Uma proposta foi marcada como <strong style="color:#f8fafc">aprovada</strong>.',
            config.create_task ? 'Tarefa de follow-up criada automaticamente.' : '',
          ],
          'Ver proposta',
          context.proposalId ? `/proposals/${context.proposalId}` : '/proposals',
        )
      }
      break
    }

    case 'lead_lost': {
      await createNote(supabase, config, context)
      await createNotification(
        supabase, config,
        `Lead perdido: ${context.leadName ?? ''}`,
        (config.note_text as string) ?? null,
        '/pipeline'
      )
      if (config.send_email) {
        await sendEmail(
          `❌ Lead perdido: ${context.leadName ?? ''}`,
          [
            `O lead <strong style="color:#f8fafc">${context.leadName ?? 'desconhecido'}</strong> foi marcado como perdido.`,
            config.note_text ? `Nota registrada: ${config.note_text as string}` : '',
          ],
          'Ver pipeline',
          '/pipeline',
        )
      }
      break
    }

    case 'client_churned': {
      await createTask(supabase, config, context)
      await createNotification(
        supabase, config,
        `Cliente inativo: ${context.clientName ?? ''}`,
        null,
        context.clientId ? `/clients/${context.clientId}` : '/clients'
      )
      if (config.send_email) {
        await sendEmail(
          `⚠️ Cliente inativo: ${context.clientName ?? ''}`,
          [
            `O cliente <strong style="color:#f8fafc">${context.clientName ?? 'desconhecido'}</strong> foi marcado como inativo ou churned.`,
            config.create_task ? 'Tarefa de reengajamento criada automaticamente.' : '',
          ],
          'Ver cliente',
          context.clientId ? `/clients/${context.clientId}` : '/clients',
        )
      }
      break
    }
  }
}
