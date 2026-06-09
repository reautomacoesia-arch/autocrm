'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent, Extension } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import {
  ArrowLeft, Bold, BookOpen, Code, ChevronDown, FileText, Globe,
  Heading1, Heading2, Heading3, Highlighter, Italic, List,
  ListChecks, ListOrdered, Lock, Minus, Palette, Plus, Quote,
  RotateCcw, SquareCode, Strikethrough, TableIcon, Trash2, Type,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkspaceDoc {
  id: string; title: string; content: object
  visibility: 'personal' | 'shared'; created_by: string
  parent_id?: string | null; created_at: string; updated_at: string
}
interface NotebookInfo {
  id: string; title: string; visibility: 'personal' | 'shared'; created_by: string
}
interface PageInfo { id: string; title: string; created_at: string }
interface SlashCmd {
  category: string; title: string; description: string; icon: React.ReactNode
  command: (p: { editor: NonNullable<ReturnType<typeof useEditor>>; range: { from: number; to: number } }) => void
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Padrão',   color: null },
  { label: 'Cinza',    color: '#8a8a93' },
  { label: 'Vermelho', color: '#ef4444' },
  { label: 'Laranja',  color: '#f97316' },
  { label: 'Amarelo',  color: '#eab308' },
  { label: 'Verde',    color: '#22c55e' },
  { label: 'Azul',     color: '#3b82f6' },
  { label: 'Roxo',     color: '#a855f7' },
  { label: 'Rosa',     color: '#ec4899' },
]
const HIGHLIGHT_COLORS = [
  { label: 'Nenhum',   color: null },
  { label: 'Amarelo',  color: '#fef08a' },
  { label: 'Verde',    color: '#bbf7d0' },
  { label: 'Azul',     color: '#bfdbfe' },
  { label: 'Rosa',     color: '#fbcfe8' },
  { label: 'Laranja',  color: '#fed7aa' },
  { label: 'Roxo',     color: '#e9d5ff' },
]

// ─── Slash commands ───────────────────────────────────────────────────────────
const SLASH_COMMANDS: SlashCmd[] = [
  { category: 'Texto', title: 'Texto', description: 'Parágrafo normal', icon: <Type size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run() },
  { category: 'Texto', title: 'Título 1', description: 'Título grande', icon: <Heading1 size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run() },
  { category: 'Texto', title: 'Título 2', description: 'Título médio', icon: <Heading2 size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run() },
  { category: 'Texto', title: 'Título 3', description: 'Título pequeno', icon: <Heading3 size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run() },
  { category: 'Listas', title: 'Lista', description: 'Marcadores', icon: <List size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { category: 'Listas', title: 'Numerada', description: 'Lista ordenada', icon: <ListOrdered size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { category: 'Listas', title: 'Checklist', description: 'Lista de tarefas', icon: <ListChecks size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { category: 'Conteúdo', title: 'Citação', description: 'Bloco de citação', icon: <Quote size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  { category: 'Conteúdo', title: 'Código', description: 'Bloco de código', icon: <SquareCode size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { category: 'Conteúdo', title: 'Divisor', description: 'Linha horizontal', icon: <Minus size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
  { category: 'Organização', title: 'Tabela', description: '3 colunas × 3 linhas', icon: <TableIcon size={14} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
]

// ─── Sub-components ───────────────────────────────────────────────────────────
function SlashMenu({ items, selectedIndex, onSelect, coords }: {
  items: SlashCmd[]; selectedIndex: number
  onSelect: (cmd: SlashCmd) => void; coords: { top: number; left: number }
}) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => { itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' }) }, [selectedIndex])
  if (items.length === 0) return null
  const categories = Array.from(new Set(items.map((c) => c.category)))
  let globalIdx = 0
  return (
    <div className="fixed z-[9999] bg-[#1a1a1d] border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-[340px]"
      style={{ top: coords.top, left: coords.left }} onMouseDown={(e) => e.preventDefault()}>
      <div className="p-2 max-h-80 overflow-y-auto space-y-3">
        {categories.map((cat) => {
          const catItems = items.filter((c) => c.category === cat)
          return (
            <div key={cat}>
              <p className="text-slate-600 text-[10px] px-1 pb-1 uppercase tracking-wider font-medium">{cat}</p>
              <div className="grid grid-cols-2 gap-1">
                {catItems.map((item) => {
                  const idx = globalIdx++
                  return (
                    <button key={item.title} ref={(el) => { itemRefs.current[idx] = el }}
                      onClick={() => onSelect(item)}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left ${idx === selectedIndex ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-300 hover:bg-slate-700/50'}`}>
                      <div className="w-7 h-7 bg-slate-800 rounded-md flex items-center justify-center flex-shrink-0 text-slate-400">{item.icon}</div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs leading-tight truncate">{item.title}</p>
                        <p className="text-[10px] text-slate-500 leading-tight truncate">{item.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ColorPalette({ colors, onSelect, currentColor, label }: {
  colors: { label: string; color: string | null }[]
  onSelect: (color: string | null) => void
  currentColor: string | null; label: string
}) {
  return (
    <div className="absolute top-full left-0 mt-1 bg-[#111113] border border-slate-700 rounded-xl shadow-2xl p-2 z-50 w-44">
      <p className="text-slate-500 text-[10px] uppercase tracking-wider px-1 pb-1">{label}</p>
      <div className="grid grid-cols-3 gap-1">
        {colors.map(({ label: lbl, color }) => (
          <button key={lbl} title={lbl} onClick={() => onSelect(color)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-slate-700/50 ${currentColor === color ? 'bg-slate-700' : ''}`}>
            <span className="w-3 h-3 rounded-full flex-shrink-0 border border-slate-600" style={{ background: color ?? 'transparent' }} />
            <span className="text-slate-300 truncate text-[10px]">{lbl}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function createSlashExtension(callbacksRef: React.MutableRefObject<{
  onStart: (p: SuggestionProps<SlashCmd>) => void
  onUpdate: (p: SuggestionProps<SlashCmd>) => void
  onKeyDown: (p: SuggestionKeyDownProps) => boolean
  onExit: () => void
}>) {
  return Extension.create({
    name: 'slashCommands',
    addOptions() {
      return { suggestion: { char: '/', command: ({ editor, range, props }: { editor: any; range: any; props: SlashCmd }) => { props.command({ editor, range }) } } }
    },
    addProseMirrorPlugins() {
      return [Suggestion({
        editor: this.editor, ...this.options.suggestion,
        items: ({ query }: { query: string }) => SLASH_COMMANDS.filter((c) =>
          c.title.toLowerCase().startsWith(query.toLowerCase()) || c.description.toLowerCase().includes(query.toLowerCase())
        ),
        render: () => ({
          onStart: (p: SuggestionProps<SlashCmd>) => callbacksRef.current.onStart(p),
          onUpdate: (p: SuggestionProps<SlashCmd>) => callbacksRef.current.onUpdate(p),
          onKeyDown: (p: SuggestionKeyDownProps) => callbacksRef.current.onKeyDown(p),
          onExit: () => callbacksRef.current.onExit(),
        }),
      })]
    },
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DocEditorPage({ doc, notebook, pages: initialPages, currentUserId }: {
  doc: WorkspaceDoc
  notebook: NotebookInfo
  pages: PageInfo[]
  currentUserId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()

  const isOwner = doc.created_by === currentUserId
  const notebookIsOwner = notebook.created_by === currentUserId
  const isPage = !!doc.parent_id
  const notebookId = doc.parent_id ?? doc.id

  const [title, setTitle] = useState(doc.title)
  const [notebookTitle, setNotebookTitle] = useState(notebook.title)
  const [editingNotebook, setEditingNotebook] = useState(false)
  const [visibility, setVisibility] = useState<'personal' | 'shared'>(doc.visibility)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved')
  const [pages, setPages] = useState<PageInfo[]>(initialPages)
  const [addingPage, setAddingPage] = useState(false)
  const [showTextColors, setShowTextColors] = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Slash menu
  const [slashMenu, setSlashMenu] = useState<{ items: SlashCmd[]; coords: { top: number; left: number }; selectedIndex: number; command: ((item: SlashCmd) => void) | null } | null>(null)
  const slashDataRef = useRef({ items: [] as SlashCmd[], selectedIndex: 0, command: null as ((item: SlashCmd) => void) | null })
  const slashCallbacksRef = useRef({
    onStart: (_p: SuggestionProps<SlashCmd>) => {},
    onUpdate: (_p: SuggestionProps<SlashCmd>) => {},
    onKeyDown: (_p: SuggestionKeyDownProps): boolean => false,
    onExit: () => {},
  })

  slashCallbacksRef.current = {
    onStart(props) {
      const coords = props.editor.view.coordsAtPos(props.range.from)
      slashDataRef.current = { items: props.items, selectedIndex: 0, command: props.command }
      setSlashMenu({ items: props.items, coords: { top: coords.bottom + 4, left: coords.left }, selectedIndex: 0, command: props.command })
    },
    onUpdate(props) {
      const coords = props.editor.view.coordsAtPos(props.range.from)
      slashDataRef.current.items = props.items; slashDataRef.current.selectedIndex = 0; slashDataRef.current.command = props.command
      setSlashMenu((prev) => prev ? { ...prev, items: props.items, coords: { top: coords.bottom + 4, left: coords.left }, selectedIndex: 0 } : null)
    },
    onKeyDown({ event }) {
      const { items, selectedIndex, command } = slashDataRef.current
      if (!items.length) return false
      if (event.key === 'ArrowDown') { const idx = (selectedIndex + 1) % items.length; slashDataRef.current.selectedIndex = idx; setSlashMenu((p) => p ? { ...p, selectedIndex: idx } : null); return true }
      if (event.key === 'ArrowUp') { const idx = (selectedIndex - 1 + items.length) % items.length; slashDataRef.current.selectedIndex = idx; setSlashMenu((p) => p ? { ...p, selectedIndex: idx } : null); return true }
      if (event.key === 'Enter') { const item = items[selectedIndex]; if (item && command) command(item); return true }
      return false
    },
    onExit() { setSlashMenu(null); slashDataRef.current = { items: [], selectedIndex: 0, command: null } },
  }

  const slashExtension = useMemo(() => createSlashExtension(slashCallbacksRef), [])

  const scheduleSave = useCallback((patch: Record<string, unknown>) => {
    if (!isOwner) return
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/docs/${doc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      setSaveStatus('saved')
    }, 1500)
  }, [doc.id, isOwner])

  const editor = useEditor({
    editable: isOwner,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList, TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Comece a escrever, ou pressione "/" para ver os blocos…' }),
      Underline, TextStyle, Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      slashExtension,
    ],
    content: doc.content as object,
    onUpdate({ editor }) { scheduleSave({ content: editor.getJSON() }) },
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-color-picker]')) { setShowTextColors(false); setShowHighlights(false) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleNotebookTitleClick() {
    if (!notebookIsOwner) return
    if (!isPage) {
      titleInputRef.current?.focus()
    } else {
      setEditingNotebook(true)
    }
  }

  async function saveNotebookTitle(val: string) {
    const trimmed = val.trim() || 'Sem título'
    setNotebookTitle(trimmed)
    setEditingNotebook(false)
    await fetch(`/api/docs/${notebook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
  }

  async function handleAddPage() {
    setAddingPage(true)
    const res = await fetch(`/api/docs/${notebookId}/pages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nova página' }),
    })
    if (res.ok) {
      const page = await res.json()
      setPages((prev) => [...prev, { id: page.id, title: page.title, created_at: page.created_at }])
      router.push(`/docs/${page.id}`)
    } else {
      toast('Erro ao criar página', 'error')
    }
    setAddingPage(false)
  }

  async function handleDeletePage(pageId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await confirm({ title: 'Excluir esta página?', description: 'Esta ação não pode ser desfeita.', destructive: true, confirmLabel: 'Excluir' })
    if (!ok) return
    const res = await fetch(`/api/docs/${pageId}`, { method: 'DELETE' })
    if (res.ok) {
      setPages((prev) => prev.filter((p) => p.id !== pageId))
      if (doc.id === pageId) router.push(`/docs/${notebookId}`)
      toast('Página excluída')
    } else { toast('Erro ao excluir página', 'error') }
  }

  async function handleDeleteNotebook() {
    const ok = await confirm({
      title: `Excluir o caderno "${notebook.title}"?`,
      description: `Isso excluirá o caderno e todas as ${pages.length} páginas dentro dele.`,
      destructive: true, confirmLabel: 'Excluir tudo',
    })
    if (!ok) return
    const res = await fetch(`/api/docs/${notebookId}`, { method: 'DELETE' })
    if (res.ok) { toast('Caderno excluído'); router.push('/docs') }
    else { toast('Erro ao excluir caderno', 'error') }
  }

  async function toggleVisibility() {
    if (!isOwner) return
    const next = visibility === 'personal' ? 'shared' : 'personal'
    setVisibility(next)
    const res = await fetch(`/api/docs/${doc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visibility: next }) })
    if (res.ok) { toast(next === 'shared' ? 'Documento compartilhado' : 'Definido como pessoal') }
    else { setVisibility(visibility); toast('Erro ao alterar visibilidade', 'error') }
  }

  const currentTextColor = editor?.getAttributes('textStyle')?.color ?? null
  const currentHighlight = editor?.getAttributes('highlight')?.color ?? null

  return (
    // -m-8 cancela o p-8 do layout pai para termos controle total do espaço
    <div className="-m-8 flex" style={{ minHeight: '100vh' }}>

      {/* ── Pages Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-r border-slate-700/50 bg-[#0d0d0f] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/30">
          <button onClick={() => router.push('/docs')} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-xs mb-4">
            <ArrowLeft size={13} /> Documentos
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600/20 rounded-md flex items-center justify-center flex-shrink-0">
              <BookOpen size={14} className="text-indigo-400" />
            </div>
            {editingNotebook && isPage ? (
              <input
                autoFocus
                value={notebookTitle}
                onChange={(e) => setNotebookTitle(e.target.value)}
                onBlur={(e) => saveNotebookTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveNotebookTitle(notebookTitle)
                  if (e.key === 'Escape') setEditingNotebook(false)
                }}
                className="bg-transparent text-white text-sm font-semibold focus:outline-none border-b border-indigo-500 w-full min-w-0"
              />
            ) : (
              <span
                onClick={handleNotebookTitleClick}
                title={notebookIsOwner ? 'Clique para editar' : ''}
                className={`text-sm font-semibold truncate ${notebookIsOwner ? 'cursor-pointer text-white hover:text-indigo-300 transition-colors' : 'text-white'}`}
              >
                {isPage ? (notebookTitle || 'Sem título') : (title || 'Sem título')}
              </span>
            )}
          </div>
        </div>

        {/* Pages list */}
        <div className="flex-1 overflow-y-auto py-2 px-1.5">
          <p className="text-slate-600 text-[10px] uppercase tracking-wider px-2 py-1.5">Páginas</p>

          {/* Notebook overview (only shown when viewing a page) */}
          {isPage && (
            <button
              onClick={() => router.push(`/docs/${notebookId}`)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 text-xs"
            >
              <FileText size={12} className="flex-shrink-0" />
              <span className="truncate italic">Visão geral</span>
            </button>
          )}

          {/* Pages */}
          {pages.map((page) => (
            <div key={page.id} className="group flex items-center">
              <button
                onClick={() => router.push(`/docs/${page.id}`)}
                className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-xs min-w-0 ${
                  doc.id === page.id
                    ? 'bg-indigo-600/15 text-indigo-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FileText size={12} className="flex-shrink-0" />
                <span className="truncate">{page.title || 'Nova página'}</span>
              </button>
              {notebookIsOwner && (
                <button
                  onClick={(e) => handleDeletePage(page.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
                  title="Excluir página"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}

          {/* Add page — inline after last page (ClickUp-style) */}
          {notebookIsOwner && (
            <button
              onClick={handleAddPage}
              disabled={addingPage}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-slate-800/40 transition-colors text-xs mt-0.5 group/add"
            >
              <Plus size={12} className="group-hover/add:text-indigo-400 transition-colors" />
              {addingPage ? 'Criando…' : 'Adicionar página'}
            </button>
          )}
        </div>

        {/* Notebook controls */}
        <div className="border-t border-slate-700/30 p-2 space-y-1">
          <div className="flex items-center gap-1 px-1">
            {isOwner && (
              <button onClick={toggleVisibility} title={visibility === 'shared' ? 'Compartilhado' : 'Pessoal'}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors flex-1 ${
                  visibility === 'shared' ? 'border-indigo-800 text-indigo-400' : 'border-slate-700 text-slate-600 hover:text-slate-400'
                }`}>
                {visibility === 'shared' ? <Globe size={10} /> : <Lock size={10} />}
                {visibility === 'shared' ? 'Compartilhado' : 'Pessoal'}
              </button>
            )}
            {notebookIsOwner && (
              <button onClick={handleDeleteNotebook} title="Excluir caderno" className="p-1 text-slate-700 hover:text-red-400 transition-colors rounded-md hover:bg-slate-800/50">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Editor area ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Editor top bar */}
        <div className="flex items-center justify-between px-10 pt-8 pb-2 flex-shrink-0">
          <div className="text-slate-600 text-xs flex items-center gap-1.5">
            <span className="text-slate-500">{(isPage ? notebookTitle : title) || 'Caderno'}</span>
            {isPage && <><span>/</span><span className="text-slate-400">{title || 'Nova página'}</span></>}
          </div>
          <span className="text-slate-600 text-xs">
            {saveStatus === 'saving' ? 'Salvando…' : saveStatus === 'saved' ? 'Salvo' : ''}
          </span>
        </div>

        {/* Document */}
        <div className="flex-1 px-10 pb-20">
          <div className="max-w-3xl mx-auto">
            {/* Title */}
            {isOwner ? (
              <input
                ref={titleInputRef}
                type="text" value={title}
                onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }) }}
                placeholder={isPage ? 'Título da página' : 'Título do caderno'}
                className="w-full bg-transparent text-white text-4xl font-bold font-display placeholder:text-slate-700 focus:outline-none mb-8 mt-4"
              />
            ) : (
              <h1 className="text-white text-4xl font-bold font-display mb-8 mt-4">{title || 'Sem título'}</h1>
            )}

            {/* Bubble Menu */}
            {editor && (
              <BubbleMenu editor={editor} shouldShow={({ from, to }) => from !== to && !editor.isActive('codeBlock')}>
                <div className="flex items-center gap-0.5 bg-[#111113] border border-slate-700 rounded-xl shadow-2xl p-1.5">
                  {[
                    { title: 'Negrito',    icon: <Bold size={13} />,          action: () => editor.chain().focus().toggleBold().run(),      active: editor.isActive('bold') },
                    { title: 'Itálico',    icon: <Italic size={13} />,        action: () => editor.chain().focus().toggleItalic().run(),    active: editor.isActive('italic') },
                    { title: 'Sublinhado', icon: <UnderlineIcon size={13} />, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline') },
                    { title: 'Riscado',    icon: <Strikethrough size={13} />, action: () => editor.chain().focus().toggleStrike().run(),    active: editor.isActive('strike') },
                    { title: 'Código',     icon: <Code size={13} />,          action: () => editor.chain().focus().toggleCode().run(),      active: editor.isActive('code') },
                  ].map(({ title, icon, action, active }) => (
                    <button key={title} onClick={action} title={title}
                      className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-indigo-600/30 text-indigo-400' : 'text-slate-300 hover:bg-slate-700/50'}`}>
                      {icon}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-slate-700 mx-0.5" />
                  {/* Text color */}
                  <div className="relative" data-color-picker>
                    <button onClick={() => { setShowTextColors((v) => !v); setShowHighlights(false) }} title="Cor do texto"
                      className="flex items-center gap-0.5 p-1.5 rounded-lg text-slate-300 hover:bg-slate-700/50 transition-colors">
                      <span className="relative">
                        <Palette size={13} />
                        {currentTextColor && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#111113]" style={{ background: currentTextColor }} />}
                      </span>
                      <ChevronDown size={10} className="text-slate-500" />
                    </button>
                    {showTextColors && (
                      <ColorPalette label="Cor do texto" colors={TEXT_COLORS} currentColor={currentTextColor}
                        onSelect={(color) => { if (color) editor.chain().focus().setColor(color).run(); else editor.chain().focus().unsetColor().run(); setShowTextColors(false) }} />
                    )}
                  </div>
                  {/* Highlight */}
                  <div className="relative" data-color-picker>
                    <button onClick={() => { setShowHighlights((v) => !v); setShowTextColors(false) }} title="Destaque"
                      className="flex items-center gap-0.5 p-1.5 rounded-lg text-slate-300 hover:bg-slate-700/50 transition-colors">
                      <span className="relative">
                        <Highlighter size={13} />
                        {currentHighlight && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#111113]" style={{ background: currentHighlight }} />}
                      </span>
                      <ChevronDown size={10} className="text-slate-500" />
                    </button>
                    {showHighlights && (
                      <ColorPalette label="Destaque" colors={HIGHLIGHT_COLORS} currentColor={currentHighlight}
                        onSelect={(color) => { if (color) editor.chain().focus().setHighlight({ color }).run(); else editor.chain().focus().unsetHighlight().run(); setShowHighlights(false) }} />
                    )}
                  </div>
                  <div className="w-px h-4 bg-slate-700 mx-0.5" />
                  <button onClick={() => editor.chain().focus().unsetAllMarks().run()} title="Remover formatação"
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700/50 transition-colors">
                    <RotateCcw size={12} />
                  </button>
                </div>
              </BubbleMenu>
            )}

            <div className="tiptap-content">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* Slash menu */}
      {slashMenu && (
        <SlashMenu items={slashMenu.items} selectedIndex={slashMenu.selectedIndex}
          onSelect={(cmd) => { slashMenu.command?.(cmd); setSlashMenu(null) }}
          coords={slashMenu.coords} />
      )}
    </div>
  )
}
