import type { LeadStage } from '@/lib/types'

export const STAGES: LeadStage[] = [
  'lead',
  'contacted',
  'proposal_sent',
  'negotiating',
  'won',
  'lost',
]

export const STAGE_LABELS: Record<LeadStage, string> = {
  lead: 'Lead',
  contacted: 'Contato feito',
  proposal_sent: 'Proposta enviada',
  negotiating: 'Negociando',
  won: 'Fechado ✓',
  lost: 'Perdido ✗',
}

export const STAGE_COLORS: Record<LeadStage, string> = {
  lead: 'text-slate-400',
  contacted: 'text-blue-400',
  proposal_sent: 'text-amber-400',
  negotiating: 'text-purple-400',
  won: 'text-emerald-400',
  lost: 'text-red-400',
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value)
}
