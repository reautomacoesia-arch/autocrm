import { createClient } from '@/lib/supabase/server'
import { AUTOMATION_DEFINITIONS, AUTOMATION_DEFAULTS } from '@/lib/automations'
import type { AutomationConfig, AutomationWorkflow } from '@/lib/types'
import AutomationCard from '@/components/automations/AutomationCard'
import WorkflowsSection from '@/components/automations/WorkflowsSection'
import PageHeader from '@/components/ui/PageHeader'
import { Zap } from 'lucide-react'

async function runScheduledAutomations() {
  'use server'
  const { POST } = await import('@/app/api/automations/run-scheduled/route')
  await POST()
}

export default async function AutomationsPage() {
  const supabase = await createClient()

  // Seed + fetch configs
  const { data: existing } = await supabase.from('automation_configs').select('*')
  const existingKeys = new Set((existing ?? []).map((c: AutomationConfig) => c.automation_key))
  const toInsert = AUTOMATION_DEFINITIONS
    .filter((def) => !existingKeys.has(def.key))
    .map((def) => ({ automation_key: def.key, enabled: false, config: AUTOMATION_DEFAULTS[def.key] ?? null }))
  if (toInsert.length > 0) {
    await supabase.from('automation_configs').insert(toInsert)
  }

  const { data: configs } = await supabase.from('automation_configs').select('*')
  const configMap: Record<string, AutomationConfig> = {}
  for (const c of configs ?? []) {
    configMap[(c as AutomationConfig).automation_key] = c as AutomationConfig
  }

  const { data: workflows } = await supabase
    .from('automation_workflows')
    .select('*')
    .order('created_at', { ascending: true })

  const eventBased = AUTOMATION_DEFINITIONS.filter((d) =>
    ['lead_won', 'proposal_approved', 'lead_lost', 'client_churned'].includes(d.key)
  )
  const timeBased = AUTOMATION_DEFINITIONS.filter((d) =>
    ['proposal_no_response', 'lead_no_contact', 'client_no_contact', 'task_overdue'].includes(d.key)
  )
  const aiBased = AUTOMATION_DEFINITIONS.filter((d) => ['ai_sdr'].includes(d.key))

  return (
    <div>
      <PageHeader
        title="Automações"
        subtitle="Configure o que acontece automaticamente quando eventos ocorrem"
        action={
          <form action={runScheduledAutomations}>
            <button
              type="submit"
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Zap size={14} />
              Executar agendadas agora
            </button>
          </form>
        }
      />

      {/* Custom workflows */}
      <WorkflowsSection initialWorkflows={(workflows ?? []) as AutomationWorkflow[]} />

      {/* Event-based */}
      <div className="mb-8">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Baseadas em eventos
        </h2>
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {eventBased.map((def) => (
            <AutomationCard
              key={def.key}
              definition={def}
              config={configMap[def.key] ?? null}
            />
          ))}
        </div>
      </div>

      {/* Time-based */}
      <div className="mb-8">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Baseadas em tempo
        </h2>
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {timeBased.map((def) => (
            <AutomationCard
              key={def.key}
              definition={def}
              config={configMap[def.key] ?? null}
            />
          ))}
        </div>
      </div>

      {/* AI */}
      <div>
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Inteligência artificial
        </h2>
        <div className="grid grid-cols-1 gap-3 max-w-2xl">
          {aiBased.map((def) => (
            <AutomationCard
              key={def.key}
              definition={def}
              config={configMap[def.key] ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
