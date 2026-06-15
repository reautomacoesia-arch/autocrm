import { createClient } from '@/lib/supabase/server'
import KanbanBoard from '@/components/pipeline/KanbanBoard'
import { DEFAULT_STAGES } from '@/lib/pipeline'
import type { Lead, PipelineStage } from '@/lib/types'

export default async function PipelinePage() {
  const supabase = await createClient()
  const [leadsRes, stagesRes] = await Promise.all([
    supabase.from('leads').select('*').order('created_at', { ascending: false }),
    supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
  ])

  const leads = (leadsRes.data as Lead[]) ?? []
  const stages = (stagesRes.data as PipelineStage[] | null)?.length
    ? (stagesRes.data as PipelineStage[])
    : DEFAULT_STAGES

  return <KanbanBoard initialLeads={leads} initialStages={stages} />
}
