'use client'

import type { Lead, PipelineStage } from '@/lib/types'
import { SOURCE_LABELS } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import LeadScoreBadge from './LeadScoreBadge'

interface LeadsTableProps {
  leads: Lead[]
  stages: PipelineStage[]
  stagesBySlug: Record<string, PipelineStage>
  onRowClick: (lead: Lead) => void
  onStageChange: (lead: Lead, newStage: string) => void
}

export default function LeadsTable({ leads, stages, stagesBySlug, onRowClick, onStageChange }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-10 text-center text-slate-500 text-sm">
        Nenhum lead cadastrado ainda.
      </div>
    )
  }

  return (
    <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-left text-slate-500 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Estágio</th>
            <th className="px-4 py-3 font-medium text-right">Valor</th>
            <th className="px-4 py-3 font-medium">Origem</th>
            <th className="px-4 py-3 font-medium">Próximo passo</th>
            <th className="px-4 py-3 font-medium text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const stage = stagesBySlug[lead.stage]
            return (
              <tr
                key={lead.id}
                onClick={() => onRowClick(lead)}
                className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-white font-medium">{lead.name}</td>
                <td className="px-4 py-3 text-slate-400">{lead.company ?? '—'}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={lead.stage}
                    onChange={(e) => onStageChange(lead, e.target.value)}
                    className="bg-[#050505] border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                    style={{ color: stage?.color ?? '#94a3b8' }}
                  >
                    {stages.map((s) => (
                      <option key={s.slug} value={s.slug} style={{ color: '#e2e8f0' }}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-emerald-400 text-right font-medium">
                  {lead.estimated_value > 0 ? formatCurrency(lead.estimated_value) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {lead.source ? (SOURCE_LABELS[lead.source] ?? lead.source) : '—'}
                </td>
                <td className="px-4 py-3 text-amber-300 max-w-[220px] truncate">{lead.next_step ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <LeadScoreBadge score={lead.score} reason={lead.score_reason} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
