'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Target,
  Users,
  FileText,
  BookOpen,
  Inbox,
  CheckSquare,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import type { SearchResultItem } from '@/app/api/search/route'
import { NAV_ITEMS } from '@/lib/navigation'

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

interface PaletteItem {
  key: string
  icon: LucideIcon
  title: string
  subtitle?: string | null
  typeLabel: string
  onSelect: () => void
}

interface StaticEntry {
  key: string
  label: string
  href: string
  icon: LucideIcon
  typeLabel: string
}

// Ações rápidas (quick-create)
const QUICK_ACTIONS: StaticEntry[] = [
  { key: 'action-lead', label: 'Criar lead', href: '/pipeline?new=1', icon: Target, typeLabel: 'Ação' },
  { key: 'action-task', label: 'Nova tarefa', href: '/tasks?new=1', icon: CheckSquare, typeLabel: 'Ação' },
  { key: 'action-proposal', label: 'Nova proposta', href: '/proposals?new=1', icon: FileText, typeLabel: 'Ação' },
  { key: 'action-client', label: 'Novo cliente', href: '/clients?new=1', icon: Users, typeLabel: 'Ação' },
]

// Navegação ("Ir para…") — derivada de lib/navigation.ts (os mesmos destinos do Sidebar)
const NAV_DESTINATIONS: StaticEntry[] = NAV_ITEMS.map((item) => ({
  key: `nav-${item.href === '/' ? 'dashboard' : item.href.slice(1)}`,
  label: `Ir para ${item.label}`,
  href: item.href,
  icon: item.icon,
  typeLabel: 'Navegação',
}))

const COMMAND_ENTRIES: StaticEntry[] = [...QUICK_ACTIONS, ...NAV_DESTINATIONS]

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
    if (query.trim().length < 2) {
      return
    }
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

  function handleQueryChange(value: string) {
    setQuery(value)
    setActiveIndex(0)
  }

  const navigateTo = useCallback(
    (href: string) => {
      router.push(href)
      close()
    },
    [router, close]
  )

  const trimmedQuery = query.trim()
  const isSearching = trimmedQuery.length >= 2
  const normalizedQuery = normalize(trimmedQuery)

  // Comandos (ações + navegação) filtrados por match no label
  const matchingCommands = useMemo(() => {
    if (!isSearching) return COMMAND_ENTRIES
    return COMMAND_ENTRIES.filter((entry) => normalize(entry.label).includes(normalizedQuery))
  }, [isSearching, normalizedQuery])

  const matchingActions = matchingCommands.filter((c) => c.typeLabel === 'Ação')
  const matchingNav = matchingCommands.filter((c) => c.typeLabel === 'Navegação')

  // Array achatado de itens selecionáveis (ordem: ações, navegação, resultados de busca)
  const items = useMemo<PaletteItem[]>(() => {
    const commandItems: PaletteItem[] = matchingCommands.map((entry) => ({
      key: entry.key,
      icon: entry.icon,
      title: entry.label,
      typeLabel: entry.typeLabel,
      onSelect: () => navigateTo(entry.href),
    }))

    if (!isSearching) return commandItems

    const resultItems: PaletteItem[] = results.map((item) => ({
      key: `${item.type}-${item.id}`,
      icon: TYPE_ICONS[item.type],
      title: item.title,
      subtitle: item.subtitle,
      typeLabel: TYPE_LABELS[item.type],
      onSelect: () => navigateTo(item.href),
    }))

    return [...commandItems, ...resultItems]
  }, [matchingCommands, isSearching, results, navigateTo])

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[activeIndex]
      if (item) item.onSelect()
    }
  }

  if (!isOpen) return null

  // Índices de offset para renderizar a lista combinada com cabeçalhos de seção
  const actionsCount = matchingActions.length
  const navCount = matchingNav.length
  const resultsCount = isSearching ? results.length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60" onClick={close} />
      <div className="relative bg-[#1a1a1d] rounded-xl border border-slate-700 w-full max-w-lg mx-4 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
          <Search size={16} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar leads, clientes, propostas, documentos, conversas..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-500"
          />
          <kbd className="text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5 flex-shrink-0">
            esc
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {/* Seção Ações */}
          {actionsCount > 0 && (
            <div>
              <p className="text-slate-600 text-[10px] uppercase tracking-wider px-4 py-1">Ações</p>
              {items.slice(0, actionsCount).map((item, i) => (
                <PaletteRow key={item.key} item={item} isActive={i === activeIndex} onHover={() => setActiveIndex(i)} />
              ))}
            </div>
          )}

          {/* Seção Navegação */}
          {navCount > 0 && (
            <div>
              <p className="text-slate-600 text-[10px] uppercase tracking-wider px-4 py-1">Navegação</p>
              {items.slice(actionsCount, actionsCount + navCount).map((item, i) => {
                const idx = actionsCount + i
                return (
                  <PaletteRow key={item.key} item={item} isActive={idx === activeIndex} onHover={() => setActiveIndex(idx)} />
                )
              })}
            </div>
          )}

          {/* Seção Resultados de busca */}
          {isSearching && (
            <div>
              {(actionsCount > 0 || navCount > 0) && (
                <p className="text-slate-600 text-[10px] uppercase tracking-wider px-4 py-1">Resultados</p>
              )}
              {loading && <p className="text-slate-500 text-xs px-4 py-3">Buscando...</p>}
              {!loading && resultsCount === 0 && (
                <p className="text-slate-500 text-xs px-4 py-3">Nada encontrado para &quot;{query}&quot;</p>
              )}
              {!loading &&
                items.slice(actionsCount + navCount).map((item, i) => {
                  const idx = actionsCount + navCount + i
                  return (
                    <PaletteRow key={item.key} item={item} isActive={idx === activeIndex} onHover={() => setActiveIndex(idx)} />
                  )
                })}
            </div>
          )}

          {!isSearching && trimmedQuery.length > 0 && items.length === 0 && (
            <p className="text-slate-500 text-xs px-4 py-3">Digite pelo menos 2 caracteres para buscar...</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface PaletteRowProps {
  item: PaletteItem
  isActive: boolean
  onHover: () => void
}

function PaletteRow({ item, isActive, onHover }: PaletteRowProps) {
  const Icon = item.icon
  const isCommand = item.typeLabel === 'Ação' || item.typeLabel === 'Navegação'
  return (
    <button
      onClick={item.onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isActive ? 'bg-indigo-600/20' : 'hover:bg-slate-800/50'
      }`}
    >
      <Icon size={15} className="text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{item.title}</p>
        {item.subtitle && <p className="text-slate-500 text-xs truncate">{item.subtitle}</p>}
      </div>
      {isCommand ? (
        <ArrowRight size={13} className="text-slate-500 flex-shrink-0" />
      ) : (
        <span className="text-[10px] text-slate-500 border border-slate-700 rounded-full px-2 py-0.5 flex-shrink-0">
          {item.typeLabel}
        </span>
      )}
    </button>
  )
}
