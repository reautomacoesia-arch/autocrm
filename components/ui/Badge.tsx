import React from 'react'

type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'indigo'

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
  yellow: 'bg-amber-900/30 text-amber-400 border-amber-800',
  red: 'bg-red-900/30 text-red-400 border-red-800',
  blue: 'bg-blue-900/30 text-blue-400 border-blue-800',
  gray: 'bg-slate-800 text-slate-400 border-slate-700',
  indigo: 'bg-indigo-900/30 text-indigo-400 border-indigo-800',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

export default function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
