'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Globe, Lock, Plus, Trash2, Users } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmModal'
import PageHeader from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/client'
import type { DocVisibility } from '@/lib/types'

interface Doc {
  id: string
  title: string
  visibility: DocVisibility
  created_by: string
  updated_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function DocsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
    fetch('/api/docs?root=1')
      .then((r) => r.json())
      .then((d) => { setDocs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleCreate(visibility: DocVisibility) {
    setCreating(true)
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    })
    if (res.ok) {
      const doc = await res.json()
      router.push(`/docs/${doc.id}`)
    } else {
      const body = await res.json().catch(() => null)
      toast(body?.error ? `Erro ao criar documento: ${body.error}` : 'Erro ao criar documento', 'error')
      setCreating(false)
    }
  }

  async function handleDelete(doc: Doc, e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await confirm({
      title: 'Excluir este documento?',
      description: 'Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: 'Excluir',
    })
    if (!ok) return
    const res = await fetch(`/api/docs/${doc.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      toast('Documento excluído')
    } else {
      toast('Erro ao excluir', 'error')
    }
  }

  const myDocs = docs.filter((d) => d.created_by === currentUserId)
  const sharedDocs = docs.filter(
    (d) => (d.visibility === 'shared' || d.visibility === 'specific') && d.created_by !== currentUserId
  )

  function DocRow({ doc }: { doc: Doc }) {
    const isOwner = doc.created_by === currentUserId
    return (
      <div
        onClick={() => router.push(`/docs/${doc.id}`)}
        className="flex items-center gap-3 px-4 py-3 bg-[#1a1a1d] border border-slate-700 rounded-lg cursor-pointer hover:border-slate-500 transition-colors group"
      >
        <FileText size={16} className="text-slate-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{doc.title || 'Sem título'}</p>
          <p className="text-slate-500 text-xs mt-0.5">{formatDate(doc.updated_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {doc.visibility === 'shared' ? (
            <span className="flex items-center gap-1 text-indigo-400 text-xs">
              <Globe size={11} /> Compartilhado
            </span>
          ) : doc.visibility === 'specific' ? (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <Users size={11} /> Pessoas específicas
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-600 text-xs">
              <Lock size={11} /> Pessoal
            </span>
          )}
          {isOwner && (
            <button
              onClick={(e) => handleDelete(doc, e)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
              title="Excluir"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <PageHeader
        title="Documentos"
        subtitle="Notas, wikis e documentos do time"
        action={
          <>
            <button
              onClick={() => handleCreate('personal')}
              disabled={creating}
              className="flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <Lock size={13} /> Pessoal
            </button>
            <button
              onClick={() => handleCreate('shared')}
              disabled={creating}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#050505] font-medium rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <Plus size={14} /> Novo documento
            </button>
          </>
        }
      />

      {loading ? (
        <div className="text-center text-slate-500 text-sm py-12">Carregando…</div>
      ) : (
        <div className="space-y-8">
          {/* Meus documentos */}
          <section>
            <h2 className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
              <Lock size={11} /> Meus documentos
            </h2>
            {myDocs.length === 0 ? (
              <p className="text-slate-600 text-sm py-4 text-center border border-dashed border-slate-800 rounded-lg">
                Nenhum documento ainda.{' '}
                <button onClick={() => handleCreate('personal')} className="text-indigo-400 hover:underline">
                  Criar um
                </button>
              </p>
            ) : (
              <div className="space-y-2">
                {myDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)}
              </div>
            )}
          </section>

          {/* Compartilhados pelo time */}
          {sharedDocs.length > 0 && (
            <section>
              <h2 className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                <Globe size={11} /> Compartilhados pelo time
              </h2>
              <div className="space-y-2">
                {sharedDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
