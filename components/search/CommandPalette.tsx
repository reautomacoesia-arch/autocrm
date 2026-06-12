'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Target, Users, FileText, BookOpen, Inbox } from 'lucide-react'
import type { SearchResultItem } from '@/app/api/search/route'

const TYPE_ICONS = {
  lead: Target,
  client: Users,
  proposal: FileText,
  doc: BookOpen,
  conversation: Inbox,
}

const TYPE_LABELS: Record<SearchResultItem['type'], string> = {
  lead: 'Lead',
  client: 'Cliente',
  proposal: 'Proposta',
  doc: 'Documento',
  conversation: 'Conversa',
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setActiveIndex(0)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [close])

  useEffect(() => {
    function handleOpenEvent() {
      setIsOpen(true)
    }
    window.addEventListener('open-command-palette', handleOpenEvent)
    return () => window.removeEventListener('open-command-palette', handleOpenEvent)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  useEffect(() => {
    if (query.trim().length < 2) return
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(Array.isArray(data) ? data : [])
          setActiveIndex(0)
        })
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  function navigateTo(item: SearchResultItem) {
    router.push(item.href)
    close()
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[activeIndex]
      if (item) navigateTo(item)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60" onClick={close} />
      <div className="relative bg-[#1a1a1d] rounded-xl border border-slate-700 w-full max-w-lg mx-4 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
          <Search size={16} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar leads, clientes, propostas, documentos, conversas..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-500"
          />
          <kbd className="text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 flex-shrink-0">
            esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && <p className="text-slate-500 text-xs px-4 py-3">Buscando...</p>}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-slate-500 text-xs px-4 py-3">Nada encontrado para &quot;{query}&quot;</p>
          )}
          {!loading && query.trim().length < 2 && (
            <p className="text-slate-500 text-xs px-4 py-3">Digite pelo menos 2 caracteres...</p>
          )}
          {!loading && query.trim().length >= 2 && results.map((item, i) => {
            const Icon = TYPE_ICONS[item.type]
            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => navigateTo(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === activeIndex ? 'bg-indigo-600/20' : 'hover:bg-slate-800/50'
                }`}
              >
                <Icon size={15} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-slate-500 text-xs truncate">{item.subtitle}</p>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 border border-slate-700 rounded-full px-2 py-0.5 flex-shrink-0">
                  {TYPE_LABELS[item.type]}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
