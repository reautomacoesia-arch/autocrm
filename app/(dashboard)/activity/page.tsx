import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const PAGE_SIZE = 10

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

  const [interactionsRes, countRes] = await Promise.all([
    supabase
      .from('interactions')
      .select('id, type, description, happened_at, clients(id, name)')
      .order('happened_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true }),
  ])

  const interactions = interactionsRes.data ?? []
  const totalCount = countRes.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

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
        <p className="text-slate-400 text-sm mt-1">{totalCount} interação(ões) registrada(s)</p>
      </div>

      {interactions.length === 0 ? (
        <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-12 text-center text-slate-500 text-sm">
          Nenhuma interação registrada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {interactions.map((interaction: any) => (
            <div
              key={interaction.id}
              className="bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {TYPE_ICON[interaction.type] ?? '📝'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm">{interaction.description}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {interaction.clients && (
                      <Link
                        href={`/clients/${interaction.clients.id}`}
                        className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
                      >
                        {interaction.clients.name}
                      </Link>
                    )}
                    <span className="text-slate-500 text-xs">
                      {formatDatetime(interaction.happened_at)}
                    </span>
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
