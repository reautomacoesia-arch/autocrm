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
import Suggestion from '@tiptap/suggestion'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import {
  ArrowLeft, Bold, Code, Globe, Heading1, Heading2, Heading3,
  Italic, List, ListOrdered, Lock, Minus, Quote, Strikethrough,
  SquareCode, Type, ListChecks, Trash2,
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'

// ─── Types ───────────────────────────────────────────────────────────────────
interface WorkspaceDoc {
  id: string
  title: string
  content: object
  visibility: 'personal' | 'shared'
  created_by: string
  created_at: string
  updated_at: string
}

interface SlashCmd {
  title: string
  description: string
  icon: React.ReactNode
  command: (params: { editor: NonNullable<ReturnType<typeof useEditor>>; range: { from: number; to: number } }) => void
}

// ─── Slash commands list ──────────────────────────────────────────────────────
const SLASH_COMMANDS: SlashCmd[] = [
  {
    title: 'Texto',
    description: 'Parágrafo normal',
    icon: <Type size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: 'Título 1',
    description: 'Título grande',
    icon: <Heading1 size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: 'Título 2',
    description: 'Título médio',
    icon: <Heading2 size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: 'Título 3',
    description: 'Título pequeno',
    icon: <Heading3 size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: 'Lista',
    description: 'Lista com marcadores',
    icon: <List size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Lista numerada',
    description: 'Lista ordenada',
    icon: <ListOrdered size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Checklist',
    description: 'Lista de tarefas',
    icon: <ListChecks size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Citação',
    description: 'Bloco de citação',
    icon: <Quote size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Código',
    description: 'Bloco de código',
    icon: <SquareCode size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divisor',
    description: 'Linha horizontal',
    icon: <Minus size={15} />,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
]

// ─── Slash Menu UI ────────────────────────────────────────────────────────────
function SlashMenu({
  items,
  selectedIndex,
  onSelect,
  coords,
}: {
  items: SlashCmd[]
  selectedIndex: number
  onSelect: (cmd: SlashCmd) => void
  coords: { top: number; left: number }
}) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (items.length === 0) return null

  return (
    <div
      className="fixed z-[9999] bg-[#1a1a1d] border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-64"
      style={{ top: coords.top, left: coords.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="p-1.5 max-h-72 overflow-y-auto">
        <p className="text-slate-600 text-[10px] px-2 py-1 uppercase tracking-wider font-medium">Blocos</p>
        {items.map((item, i) => (
          <button
            key={item.title}
            ref={(el) => { itemRefs.current[i] = el }}
            onClick={() => onSelect(item)}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${
              i === selectedIndex
                ? 'bg-indigo-600/20 text-indigo-400'
                : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <div className="w-8 h-8 bg-slate-800 rounded-md flex items-center justify-center flex-shrink-0 text-slate-400">
              {item.icon}
            </div>
            <div className="text-left">
              <p className="font-medium text-sm leading-tight">{item.title}</p>
              <p className="text-[11px] text-slate-500 leading-tight">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Slash Commands Tiptap Extension ─────────────────────────────────────────
function createSlashExtension(callbacksRef: React.MutableRefObject<{
  onStart: (p: SuggestionProps<SlashCmd>) => void
  onUpdate: (p: SuggestionProps<SlashCmd>) => void
  onKeyDown: (p: SuggestionKeyDownProps) => boolean
  onExit: () => void
}>) {
  return Extension.create({
    name: 'slashCommands',
    addOptions() {
      return {
        suggestion: {
          char: '/',
          command: ({ editor, range, props }: { editor: any; range: any; props: SlashCmd }) => {
            props.command({ editor, range })
          },
        },
      }
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
          items: ({ query }: { query: string }) =>
            SLASH_COMMANDS.filter((c) =>
              c.title.toLowerCase().startsWith(query.toLowerCase()) ||
              c.description.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 10),
          render: () => ({
            onStart: (p: SuggestionProps<SlashCmd>) => callbacksRef.current.onStart(p),
            onUpdate: (p: SuggestionProps<SlashCmd>) => callbacksRef.current.onUpdate(p),
            onKeyDown: (p: SuggestionKeyDownProps) => callbacksRef.current.onKeyDown(p),
            onExit: () => callbacksRef.current.onExit(),
          }),
        }),
      ]
    },
  })
}

// ─── Main Editor Page ─────────────────────────────────────────────────────────
export default function DocEditorPage({
  doc,
  currentUserId,
}: {
  doc: WorkspaceDoc
  currentUserId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()
  const isOwner = doc.created_by === currentUserId

  const [title, setTitle] = useState(doc.title)
  const [visibility, setVisibility] = useState<'personal' | 'shared'>(doc.visibility)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Slash menu state ──────────────────────────────────────────────────────
  const [slashMenu, setSlashMenu] = useState<{
    items: SlashCmd[]
    coords: { top: number; left: number }
    selectedIndex: number
    command: ((item: SlashCmd) => void) | null
  } | null>(null)
  const slashDataRef = useRef({ items: [] as SlashCmd[], selectedIndex: 0, command: null as ((item: SlashCmd) => void) | null })

  const slashCallbacksRef = useRef({
    onStart: (_p: SuggestionProps<SlashCmd>) => {},
    onUpdate: (_p: SuggestionProps<SlashCmd>) => {},
    onKeyDown: (_p: SuggestionKeyDownProps): boolean => false,
    onExit: () => {},
  })

  // Wire callbacks (always current closure)
  slashCallbacksRef.current = {
    onStart(props) {
      const coords = props.editor.view.coordsAtPos(props.range.from)
      slashDataRef.current = { items: props.items, selectedIndex: 0, command: props.command }
      setSlashMenu({
        items: props.items,
        coords: { top: coords.bottom + 4, left: coords.left },
        selectedIndex: 0,
        command: props.command,
      })
    },
    onUpdate(props) {
      const coords = props.editor.view.coordsAtPos(props.range.from)
      slashDataRef.current.items = props.items
      slashDataRef.current.selectedIndex = 0
      slashDataRef.current.command = props.command
      setSlashMenu((prev) =>
        prev
          ? { ...prev, items: props.items, coords: { top: coords.bottom + 4, left: coords.left }, selectedIndex: 0 }
          : null
      )
    },
    onKeyDown({ event }) {
      const { items, selectedIndex, command } = slashDataRef.current
      if (!items.length) return false
      if (event.key === 'ArrowDown') {
        const idx = (selectedIndex + 1) % items.length
        slashDataRef.current.selectedIndex = idx
        setSlashMenu((p) => p ? { ...p, selectedIndex: idx } : null)
        return true
      }
      if (event.key === 'ArrowUp') {
        const idx = (selectedIndex - 1 + items.length) % items.length
        slashDataRef.current.selectedIndex = idx
        setSlashMenu((p) => p ? { ...p, selectedIndex: idx } : null)
        return true
      }
      if (event.key === 'Enter') {
        const item = items[selectedIndex]
        if (item && command) command(item)
        return true
      }
      return false
    },
    onExit() {
      setSlashMenu(null)
      slashDataRef.current = { items: [], selectedIndex: 0, command: null }
    },
  }

  // ── Create extension once ─────────────────────────────────────────────────
  const slashExtension = useMemo(() => createSlashExtension(slashCallbacksRef), [])

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const scheduleSave = useCallback(
    (patch: Record<string, unknown>) => {
      if (!isOwner) return
      setSaveStatus('saving')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        await fetch(`/api/docs/${doc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        setSaveStatus('saved')
      }, 1500)
    },
    [doc.id, isOwner]
  )

  // ── Editor ────────────────────────────────────────────────────────────────
  const editor = useEditor({
    editable: isOwner,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Comece a escrever, ou pressione "/" para ver os comandos…' }),
      slashExtension,
    ],
    content: doc.content as object,
    onUpdate({ editor }) {
      scheduleSave({ content: editor.getJSON() })
    },
  })

  // ── Title save ────────────────────────────────────────────────────────────
  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value)
    scheduleSave({ title: e.target.value })
  }

  // ── Visibility toggle ─────────────────────────────────────────────────────
  async function toggleVisibility() {
    if (!isOwner) return
    const next = visibility === 'personal' ? 'shared' : 'personal'
    setVisibility(next)
    const res = await fetch(`/api/docs/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: next }),
    })
    if (res.ok) {
      toast(next === 'shared' ? 'Documento compartilhado com o time' : 'Documento definido como pessoal')
    } else {
      setVisibility(visibility) // revert
      toast('Erro ao alterar visibilidade', 'error')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    const ok = await confirm({
      title: 'Excluir este documento?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    const res = await fetch(`/api/docs/${doc.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Documento excluído')
      router.push('/docs')
    } else {
      toast('Erro ao excluir', 'error')
    }
  }

  return (
    <div className="min-h-screen">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <button
          onClick={() => router.push('/docs')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={15} /> Documentos
        </button>

        <div className="flex items-center gap-2">
          {/* Save status */}
          <span className="text-slate-600 text-xs">
            {saveStatus === 'saving' ? 'Salvando…' : saveStatus === 'saved' ? 'Salvo' : ''}
          </span>

          {isOwner && (
            <>
              {/* Visibility toggle */}
              <button
                onClick={toggleVisibility}
                title={visibility === 'shared' ? 'Compartilhado com o time — clique para tornar pessoal' : 'Pessoal — clique para compartilhar'}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  visibility === 'shared'
                    ? 'bg-indigo-600/15 border-indigo-700 text-indigo-400 hover:bg-indigo-600/25'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {visibility === 'shared' ? <Globe size={13} /> : <Lock size={13} />}
                {visibility === 'shared' ? 'Compartilhado' : 'Pessoal'}
              </button>

              {/* Delete */}
              <button
                onClick={handleDelete}
                title="Excluir documento"
                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Document ────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto">
        {/* Title */}
        {isOwner ? (
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Sem título"
            className="w-full bg-transparent text-white text-4xl font-bold font-display placeholder:text-slate-700 focus:outline-none mb-8"
          />
        ) : (
          <h1 className="text-white text-4xl font-bold font-display mb-8">{title || 'Sem título'}</h1>
        )}

        {/* Bubble Menu (aparece ao selecionar texto) */}
        {editor && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100 }}
            shouldShow={({ from, to }) => from !== to}
          >
            <div className="flex items-center gap-0.5 bg-[#111113] border border-slate-700 rounded-lg shadow-xl p-1">
              {[
                { title: 'Negrito', icon: <Bold size={13} />, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
                { title: 'Itálico', icon: <Italic size={13} />, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
                { title: 'Riscado', icon: <Strikethrough size={13} />, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
                { title: 'Código', icon: <Code size={13} />, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
              ].map(({ title, icon, action, active }) => (
                <button
                  key={title}
                  onClick={action}
                  title={title}
                  className={`p-1.5 rounded transition-colors ${active ? 'bg-indigo-600/30 text-indigo-400' : 'text-slate-300 hover:bg-slate-700/50'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </BubbleMenu>
        )}

        {/* Editor content */}
        <div className="tiptap-content">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Slash command menu */}
      {slashMenu && (
        <SlashMenu
          items={slashMenu.items}
          selectedIndex={slashMenu.selectedIndex}
          onSelect={(cmd) => {
            slashMenu.command?.(cmd)
            setSlashMenu(null)
          }}
          coords={slashMenu.coords}
        />
      )}
    </div>
  )
}
