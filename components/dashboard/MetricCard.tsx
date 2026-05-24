interface MetricCardProps {
  label: string
  value: string
  sub?: string
  color?: 'white' | 'green' | 'indigo' | 'amber' | 'red'
}

const colorClasses = {
  white: 'text-white',
  green: 'text-emerald-400',
  indigo: 'text-indigo-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
}

export default function MetricCard({ label, value, sub, color = 'white' }: MetricCardProps) {
  return (
    <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-5">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}
