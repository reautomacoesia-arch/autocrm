/**
 * Motor de automações plugável (Fase 4).
 * Executa workflows customizados (automation_workflows): para cada evento,
 * busca regras habilitadas do mesmo trigger_type, avalia as condições contra
 * o contexto e, se passarem, executa as ações configuradas em sequência.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { sendWhatsAppText } from '@/lib/zapi'
import type { WorkflowCondition, WorkflowAction } from '@/lib/workflow-catalog'

export type WorkflowContext = Record<string, string | number | undefined>

function toNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function evalCondition(ctx: WorkflowContext, cond: WorkflowCondition): boolean {
  const actual = ctx[cond.field]
  if (actual === undefined) return false

  switch (cond.operator) {
    case 'eq':
      return String(actual).toLowerCase() === cond.value.toLowerCase()
    case 'neq':
      return String(actual).toLowerCase() !== cond.value.toLowerCase()
    case 'contains':
      return String(actual).toLowerCase().includes(cond.value.toLowerCase())
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toNumber(actual)
      const b = toNumber(cond.value)
      if (a === null || b === null) return false
      if (cond.operator === 'gt') return a > b
      if (cond.operator === 'gte') return a >= b
      if (cond.operator === 'lt') return a < b
      return a <= b
    }
    default:
      return false
  }
}

/** Substitui {{campo}} pelo valor correspondente do contexto do evento. */
function interpolate(template: string, ctx: WorkflowContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = ctx[key]
    return value === undefined ? '' : String(value)
  })
}

async function runAction(
  supabase: SupabaseClient,
  action: WorkflowAction,
  ctx: WorkflowContext
): Promise<void> {
  const p = action.params ?? {}

  switch (action.type) {
    case 'create_task': {
      await supabase.from('tasks').insert({
        client_id: (ctx.clientId as string) ?? null,
        lead_id: (ctx.leadId as string) ?? null,
        title: interpolate(p.title || 'Tarefa automática', ctx),
        priority: p.priority || 'medium',
        status: 'pending',
      })
      break
    }

    case 'create_notification': {
      await supabase.from('notifications').insert({
        title: interpolate(p.title || 'Automação executada', ctx),
        body: null,
        link: p.link ? interpolate(p.link, ctx) : null,
      })
      break
    }

    case 'send_email': {
      await sendEmail(
        interpolate(p.subject || 'Automação executada', ctx),
        [interpolate(p.body || '', ctx)],
      )
      break
    }

    case 'send_whatsapp': {
      const phone = ctx.phone as string | undefined
      if (!phone) {
        console.warn('[workflow] send_whatsapp sem telefone no contexto, ação ignorada.')
        break
      }
      await sendWhatsAppText(phone, interpolate(p.message || '', ctx))
      break
    }

    default:
      console.warn(`[workflow] tipo de ação desconhecido: ${action.type}`)
  }
}

export async function runWorkflows(
  supabase: SupabaseClient,
  triggerType: string,
  context: WorkflowContext
): Promise<void> {
  const { data: workflows } = await supabase
    .from('automation_workflows')
    .select('*')
    .eq('trigger_type', triggerType)
    .eq('enabled', true)

  for (const wf of workflows ?? []) {
    const conditions = (wf.conditions as WorkflowCondition[] | null) ?? []
    const actions = (wf.actions as WorkflowAction[] | null) ?? []

    if (!conditions.every((c) => evalCondition(context, c))) continue

    for (const action of actions) {
      try {
        await runAction(supabase, action, context)
      } catch (err) {
        console.error(`[workflow] erro ao executar ação "${action.type}" do workflow "${wf.name}":`, err)
      }
    }
  }
}
