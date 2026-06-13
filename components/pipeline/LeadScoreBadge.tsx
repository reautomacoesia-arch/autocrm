import { Flame, Thermometer } from 'lucide-react'

interface LeadScoreBadgeProps {
  score: number | null | undefined
  reason?: string | null
  size?: 'sm' | 'md'
}

function bandClasses(score: number): string {
  if (score >= 75) return 'bg-red-500/15 text-red-300 border-red-800/50'
  if (score >= 50) return 'bg-amber-500/15 text-amber-300 border-amber-800/50'
  if (score >= 25) return 'bg-sky-500/15 text-sky-300 border-sky-800/50'
  return 'bg-slate-500/15 text-slate-400 border-slate-700/50'
}

export default function LeadScoreBadge({ score, reason, size = 'sm' }: LeadScoreBadgeProps) {
  if (score === null || score === undefined) return null

  const Icon = score >= 75 ? Flame : Thermometer
  const sizeClasses = size === 'md' ? 'text-xs px-2 py-1 gap-1.5' : 'text-[10px] px-1.5 py-0.5 gap-1'
  const iconSize = size === 'md' ? 12 : 10

  return (
    <span
      title={reason ?? undefined}
      className={`inline-flex items-center rounded-full border font-semibold ${bandClasses(score)} ${sizeClasses}`}
    >
      <Icon size={iconSize} />
      {score}
    </span>
  )
}
