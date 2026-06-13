import Link from 'next/link'
import Card from '@/components/ui/Card'
import { formatCurrency } from '@/lib/pipeline'

export interface FunnelStage {
  stage: string
  label: string
  count: number
  value: number
}

interface PipelineFunnelProps {
  stages: FunnelStage[]
}

export default function PipelineFunnel({ stages }: PipelineFunnelProps) {
  const maxCount = Math.max(1, ...stages.map((s) => s.count))

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
          Funil do pipeline
        </h2>
        <Link
          href="/pipeline"
          className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
        >
          Ver pipeline →
        </Link>
      </div>

      <Link href="/pipeline" className="block">
        <Card className="p-4 hover:border-slate-600 transition-colors">
          {stages.every((s) => s.count === 0) ? (
            <p className="text-slate-500 text-sm text-center py-4">
              Nenhum lead aberto no pipeline.
            </p>
          ) : (
            <div className="space-y-3">
              {stages.map((s) => {
                const widthPct = maxCount > 0 ? Math.max(4, (s.count / maxCount) * 100) : 0
                return (
                  <div key={s.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-xs font-medium">{s.label}</span>
                      <span className="text-slate-500 text-xs">
                        {s.count} · {formatCurrency(s.value)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#d4af37] rounded-full transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </Link>
    </div>
  )
}
