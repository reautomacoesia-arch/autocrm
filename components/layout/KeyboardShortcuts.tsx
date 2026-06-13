'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/navigation'

// Mapa de navegação rápida "g" + tecla, derivado de lib/navigation.ts
const GO_MAP: Record<string, { href: string; label: string }> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.shortcut, { href: item.href, label: item.label }])
)

const GO_SEQUENCE_TIMEOUT_MS = 1200

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

export default function KeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false)
  const [goArmed, setGoArmed] = useState(false)
  const goTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const disarmGo = useCallback(() => {
    setGoArmed(false)
    if (goTimeoutRef.current) {
      clearTimeout(goTimeoutRef.current)
      goTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignora quando o foco está em campos de digitação
      if (isTypingTarget(e.target)) return
      // Ignora combinações com modificadores (deixa Ctrl/Cmd+K etc. para outros handlers)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false)
          return
        }
        if (goArmed) {
          disarmGo()
          return
        }
        return
      }

      // Sequência "g" + tecla
      if (goArmed) {
        const target = GO_MAP[e.key.toLowerCase()]
        disarmGo()
        if (target) {
          e.preventDefault()
          router.push(target.href)
        }
        return
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowHelp((prev) => !prev)
        return
      }

      if (e.key.toLowerCase() === 'g') {
        e.preventDefault()
        setGoArmed(true)
        goTimeoutRef.current = setTimeout(() => {
          setGoArmed(false)
          goTimeoutRef.current = null
        }, GO_SEQUENCE_TIMEOUT_MS)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showHelp, goArmed, disarmGo, router])

  useEffect(() => {
    return () => {
      if (goTimeoutRef.current) clearTimeout(goTimeoutRef.current)
    }
  }, [])

  if (!showHelp) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => setShowHelp(false)} />
      <div className="relative bg-[#1a1a1d] rounded-xl border border-slate-700 w-full max-w-md mx-4 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-sm">Atalhos de teclado</h2>
          <button
            onClick={() => setShowHelp(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">Buscar / abrir launcher</span>
              <kbd className="text-[10px] text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">
                Ctrl / Cmd K
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">Esta ajuda</span>
              <kbd className="text-[10px] text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">
                ?
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm">Fechar</span>
              <kbd className="text-[10px] text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">
                Esc
              </kbd>
            </div>
          </div>

          <div>
            <p className="text-slate-600 text-[10px] uppercase tracking-wider mb-2">
              Ir para… (pressione <span className="text-slate-400">g</span> e depois a tecla)
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(GO_MAP).map(([key, { label }]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd className="text-[10px] text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">
                    g {key}
                  </kbd>
                  <span className="text-slate-400 text-xs">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
