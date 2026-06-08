'use client'

import { useEffect, useRef, useState } from 'react'
import type { Profile } from '@/lib/types'
import ProfileAvatar from './ProfileAvatar'
import { ChevronDown, X } from 'lucide-react'

interface AssigneeSelectorProps {
  profiles: Profile[]
  value: string | null        // profile id
  onChange: (id: string | null, name: string | null) => void
  className?: string
}

export default function AssigneeSelector({ profiles, value, onChange, className = '' }: AssigneeSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = profiles.find((p) => p.id === value) ?? null

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 bg-[#050505] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-left focus:outline-none focus:border-indigo-500 hover:border-slate-500 transition-colors"
      >
        {selected ? (
          <>
            <ProfileAvatar name={selected.name} color={selected.avatar_color} avatarUrl={selected.avatar_url} size="sm" />
            <span className="flex-1 text-slate-200 truncate">{selected.name}</span>
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(null, null) }}
              className="text-slate-600 hover:text-red-400 transition-colors"
            >
              <X size={12} />
            </span>
          </>
        ) : (
          <>
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-600">
              +
            </div>
            <span className="flex-1 text-slate-500">Sem responsável</span>
            <ChevronDown size={12} className="text-slate-600" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#1a1a1d] border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {profiles.length === 0 ? (
            <p className="text-slate-500 text-xs px-3 py-3 text-center">Nenhum colaborador cadastrado.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onChange(null, null); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-800 transition-colors"
              >
                <div className="w-6 h-6 rounded-full border border-slate-600" />
                Remover responsável
              </button>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p.id, p.name); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${
                    value === p.id ? 'bg-indigo-600/10' : ''
                  }`}
                >
                  <ProfileAvatar name={p.name} color={p.avatar_color} avatarUrl={p.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-slate-200 truncate">{p.name}</p>
                    {p.email && <p className="text-slate-600 truncate">{p.email}</p>}
                  </div>
                  {value === p.id && <span className="text-indigo-400 text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
