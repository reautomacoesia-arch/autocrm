'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plus, Target, CheckSquare, FileText, Users } from 'lucide-react'

const ACTIONS = [
  { href: '/pipeline', label: 'Novo lead', icon: Target },
  { href: '/tasks', label: 'Nova tarefa', icon: CheckSquare },
  { href: '/proposals', label: 'Nova proposta', icon: FileText },
  { href: '/clients', label: 'Novo cliente', icon: Users },
]

export default function QuickActions() {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center gap-1.5 bg-[#d4af37] text-[#050505] text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-[#e0bf52] transition-colors"
      >
        <Plus size={16} />
        Novo
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1d] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {ACTIONS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/40 hover:text-white transition-colors"
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
