import type { LeadStage, PipelineStage } from '@/lib/types'

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

/**
 * Estágios padrão do pipeline (fallback usado quando a tabela
 * `pipeline_stages` ainda não existe ou está vazia — ex.: antes de
 * aplicar a migration 029). Mesmos slugs já usados em `leads.stage`.
 */
export const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'default-lead',          slug: 'lead',          label: 'Lead',             color: '#64748b', type: 'open', probability: 0.10, position: 0, created_at: '' },
  { id: 'default-contacted',     slug: 'contacted',     label: 'Contato feito',    color: '#3b82f6', type: 'open', probability: 0.25, position: 1, created_at: '' },
  { id: 'default-proposal_sent', slug: 'proposal_sent', label: 'Proposta enviada', color: '#f59e0b', type: 'open', probability: 0.50, position: 2, created_at: '' },
  { id: 'default-negotiating',   slug: 'negotiating',   label: 'Negociando',       color: '#a855f7', type: 'open', probability: 0.75, position: 3, created_at: '' },
  { id: 'default-won',           slug: 'won',           label: 'Fechado',          color: '#22c55e', type: 'won',  probability: 1.00, position: 4, created_at: '' },
  { id: 'default-lost',          slug: 'lost',          label: 'Perdido',          color: '#ef4444', type: 'lost', probability: 0.00, position: 5, created_at: '' },
]

/**
 * Gera um slug simples (lowercase, sem acentos, separado por underscore)
 * a partir do label de um estágio. Usado ao criar pipeline_stages no servidor.
 */
export function slugifyStage(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'estagio'
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value)
}
