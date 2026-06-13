import Sparkline from '@/components/ui/Sparkline'
import TrendBadge from '@/components/ui/TrendBadge'

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  color?: 'white' | 'green' | 'indigo' | 'amber' | 'red'
  trend?: { delta: number; format?: 'percent' | 'absolute' }
  spark?: number[]
}

const colorClasses = {
  white: 'text-white',
  green: 'text-emerald-400',
  indigo: 'text-indigo-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
}

const sparkColors = {
  white: '#f8f9fa',
  green: '#34d399',
  indigo: '#dfc367',
  amber: '#fbbf24',
  red: '#f87171',
}

export default function MetricCard({ label, value, sub, color = 'white', trend, spark }: MetricCardProps) {
  return (
    <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">{label}</p>
        {trend && <TrendBadge delta={trend.delta} format={trend.format} />}
      </div>
      <p className={`text-2xl font-bold font-mono ${colorClasses[color]}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
      {spark && spark.length > 0 && (
        <div className="h-6 mt-3">
          <Sparkline data={spark} color={sparkColors[color]} className="w-full h-full" />
        </div>
      )}
    </div>
  )
}
