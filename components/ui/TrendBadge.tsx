import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

interface TrendBadgeProps {
  delta: number
  format?: 'percent' | 'absolute'
}

export default function TrendBadge({ delta, format = 'percent' }: TrendBadgeProps) {
  const rounded = Math.round(delta)
  const text = format === 'percent' ? `${Math.abs(rounded)}%` : `${Math.abs(rounded)}`

  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-medium">
        <Minus size={12} />
        {text}
      </span>
    )
  }

  if (rounded > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
        <TrendingUp size={12} />
        {text}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
      <TrendingDown size={12} />
      {text}
    </span>
  )
}
