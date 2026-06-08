'use client'

import { useEffect, useRef, useState } from 'react'
import type { Profile } from '@/lib/types'
import ProfileAvatar from './ProfileAvatar'
import { Check, ChevronDown, X } from 'lucide-react'

interface MultiAssigneeSelectorProps {
  profiles: Profile[]
  value: string[]                   // array de profile ids selecionados
  onChange: (ids: string[]) => void
  className?: string
}

export default function MultiAssigneeSelector({
  profiles,
  value,
  onChange,
  className = '',
}: MultiAssigneeSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = profiles.filter((p) => value.includes(p.id))

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 bg-[#050505] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-left focus:outline-none focus:border-indigo-500 hover:border-slate-500 transition-colors min-h-[32px]"
      >
        {selected.length > 0 ? (
          <>
            {/* Avatars empilhados */}
            <div className="flex items-center -space-x-1.5 flex-shrink-0">
              {selected.slice(0, 4).map((p) => (
                <ProfileAvatar
                  key={p.id}
                  name={p.name}
                  color={p.avatar_color}
                  avatarUrl={p.avatar_url}
                  size="sm"
                />
              ))}
            </div>
            <span className="flex-1 text-slate-200 truncate">
              {selected.length === 1
                ? selected[0].name
                : `${selected.length} responsáveis`}
            </span>
            {/* Limpar tudo */}
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange([]) }}
              className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <X size={12} />
            </span>
          </>
        ) : (
          <>
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-600 flex-shrink-0">
              +
            </div>
            <span className="flex-1 text-slate-500">Sem responsável</span>
            <ChevronDown size={12} className="text-slate-600" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#1a1a1d] border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {profiles.length === 0 ? (
            <p className="text-slate-500 text-xs px-3 py-3 text-center">
              Nenhum colaborador cadastrado.
            </p>
          ) : (
            <div className="max-h-52 overflow-y-auto">
              {profiles.map((p) => {
                const checked = value.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${
                      checked ? 'bg-indigo-600/10' : ''
                    }`}
                  >
                    <ProfileAvatar
                      name={p.name}
                      color={p.avatar_color}
                      avatarUrl={p.avatar_url}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-slate-200 truncate">{p.name}</p>
                      {p.email && (
                        <p className="text-slate-600 truncate">{p.email}</p>
                      )}
                    </div>
                    {/* Checkbox visual */}
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-slate-600'
                      }`}
                    >
                      {checked && <Check size={9} className="text-white" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
