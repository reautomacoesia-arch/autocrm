import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { STAGE_LABELS } from '@/lib/pipeline'
import type { LeadStage } from '@/lib/types'

const PAGE_SIZE = 20

const TYPE_ICON: Record<string, string> = {
  note: '📝',
  meeting: '📞',
  email: '✉️',
}

function formatDatetime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1') || 1)
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()

  const [interactionsRes, pipelineEventsRes] = await Promise.all([
    supabase
      .from('interactions')
      .select('id, type, description, happened_at, clients(id, name)')
      .order('happened_at', { ascending: false })
      .limit(200),
    supabase
      .from('pipeline_events')
      .select('id, lead_id, lead_name, from_stage, to_stage, happened_at')
      .order('happened_at', { ascending: false })
      .limit(200),
  ])

  type ActivityItem = {
    id: string
    icon: string
    description: string
    sub: string | null
    link?: string
    date: string
  }

  const items: ActivityItem[] = [
    ...(interactionsRes.data ?? []).map((i: any) => ({
      id: `i-${i.id}`,
      icon: TYPE_ICON[i.type] ?? '📝',
      description: i.description,
      sub: i.clients?.name ?? null,
      link: i.clients ? `/clients/${i.clients.id}` : undefined,
      date: i.happened_at,
    })),
    ...(pipelineEventsRes.data ?? []).map((e: any) => ({
      id: `p-${e.id}`,
      icon: '🔄',
      description: `${e.lead_name} avançou para ${STAGE_LABELS[e.to_stage as LeadStage] ?? e.to_stage}`,
      sub: `${STAGE_LABELS[e.from_stage as LeadStage] ?? e.from_stage} → ${STAGE_LABELS[e.to_stage as LeadStage] ?? e.to_stage}`,
      date: e.happened_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalCount = items.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const paged = items.slice(offset, offset + PAGE_SIZE)

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">
            Dashboard
          </Link>
          <span className="text-slate-600 text-sm">›</span>
          <span className="text-white text-sm">Histórico de Atividades</span>
        </div>
        <h1 className="text-white text-2xl font-bold">Histórico de Atividades</h1>
        <p className="text-slate-400 text-sm mt-1">{totalCount} registro(s)</p>
      </div>

      {paged.length === 0 ? (
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-12 text-center text-slate-500 text-sm">
          Nenhuma atividade registrada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map((item) => (
            <div
              key={item.id}
              className="bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm">{item.description}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {item.sub && item.link ? (
                      <Link
                        href={item.link}
                        className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
                      >
                        {item.sub}
                      </Link>
                    ) : item.sub ? (
                      <span className="text-slate-500 text-xs">{item.sub}</span>
                    ) : null}
                    <span className="text-slate-500 text-xs">{formatDatetime(item.date)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          {page > 1 ? (
            <Link
              href={`/activity?page=${page - 1}`}
              className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              ← Anterior
            </Link>
          ) : (
            <span className="text-slate-600 text-sm">← Anterior</span>
          )}

          <span className="text-slate-400 text-sm">
            Página {page} de {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={`/activity?page=${page + 1}`}
              className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              Próxima →
            </Link>
          ) : (
            <span className="text-slate-600 text-sm">Próxima →</span>
          )}
        </div>
      )}
    </div>
  )
}
