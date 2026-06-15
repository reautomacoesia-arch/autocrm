'use client'

import { useEffect, useState } from 'react'
import { Check, Globe, Lock, Users } from 'lucide-react'
import type { DocVisibility, Profile } from '@/lib/types'
import Modal from '@/components/ui/Modal'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { useToast } from '@/components/ui/ToastProvider'

interface DocVisibilityControlProps {
  docId: string
  visibility: DocVisibility
  currentUserId: string
  onChange: (visibility: DocVisibility) => void
  /** estilo compacto (badge) usado em listas */
  compact?: boolean
}

const OPTIONS: { value: DocVisibility; label: string; icon: React.ReactNode }[] = [
  { value: 'personal', label: 'Pessoal', icon: <Lock size={11} /> },
  { value: 'specific', label: 'Pessoas específicas', icon: <Users size={11} /> },
  { value: 'shared', label: 'Todos', icon: <Globe size={11} /> },
]

export default function DocVisibilityControl({
  docId,
  visibility,
  currentUserId,
  onChange,
  compact = false,
}: DocVisibilityControlProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const current = OPTIONS.find((o) => o.value === visibility) ?? OPTIONS[0]

  // Carrega perfis e shares atuais quando o modal abre
  useEffect(() => {
    if (!open) return
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() =>
        Promise.all([
          fetch('/api/profiles').then((r) => (r.ok ? r.json() : [])),
          fetch(`/api/docs/${docId}/shares`).then((r) => (r.ok ? r.json() : [])),
        ])
      )
      .then(([profilesData, sharesData]) => {
        const list: Profile[] = Array.isArray(profilesData) ? profilesData : []
        setProfiles(list.filter((p) => p.id !== currentUserId))
        setSelected(Array.isArray(sharesData) ? sharesData : [])
      })
      .catch(() => toast('Erro ao carregar perfis', 'error'))
      .finally(() => setLoading(false))
  }, [open, docId, currentUserId, toast])

  function toggleSelected(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  async function applyVisibility(next: DocVisibility) {
    if (next === 'specific') {
      setOpen(true)
      return
    }
    const res = await fetch(`/api/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: next }),
    })
    if (res.ok) {
      onChange(next)
      toast(next === 'shared' ? 'Documento compartilhado com todos' : 'Definido como pessoal')
    } else {
      toast('Erro ao alterar visibilidade', 'error')
    }
  }

  async function handleSaveShares() {
    setSaving(true)
    const sharesRes = await fetch(`/api/docs/${docId}/shares`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: selected }),
    })
    if (!sharesRes.ok) {
      toast('Erro ao salvar compartilhamentos', 'error')
      setSaving(false)
      return
    }
    const visRes = await fetch(`/api/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'specific' }),
    })
    setSaving(false)
    if (visRes.ok) {
      onChange('specific')
      toast(`Compartilhado com ${selected.length} pessoa${selected.length === 1 ? '' : 's'}`)
      setOpen(false)
    } else {
      toast('Erro ao alterar visibilidade', 'error')
    }
  }

  return (
    <>
      <div className={`relative ${compact ? '' : 'flex-1'}`}>
        <details className="group">
          <summary
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors cursor-pointer list-none ${
              visibility === 'shared'
                ? 'border-indigo-800 text-indigo-400'
                : visibility === 'specific'
                ? 'border-amber-800 text-amber-400'
                : 'border-slate-700 text-slate-600 hover:text-slate-400'
            } ${compact ? '' : 'flex-1 justify-center'}`}
          >
            {current.icon}
            {current.label}
          </summary>
          <div className="absolute z-50 mt-1 right-0 bg-[#1a1a1d] border border-slate-700 rounded-lg shadow-xl overflow-hidden w-44">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  // Fecha o <details>
                  const details = (e.currentTarget.closest('details') as HTMLDetailsElement | null)
                  if (details) details.open = false
                  applyVisibility(opt.value)
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${
                  visibility === opt.value ? 'text-indigo-400' : 'text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5">{opt.icon} {opt.label}</span>
                {visibility === opt.value && <Check size={12} />}
              </button>
            ))}
          </div>
        </details>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Pessoas específicas" size="sm">
        {loading ? (
          <p className="text-slate-500 text-sm text-center py-6">Carregando…</p>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-400 text-xs">
              Selecione quem pode visualizar este documento.
            </p>
            {profiles.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">
                Nenhum outro colaborador encontrado.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 -mx-1">
                {profiles.map((p) => {
                  const checked = selected.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleSelected(p.id)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs hover:bg-slate-800 transition-colors ${
                        checked ? 'bg-indigo-600/10' : ''
                      }`}
                    >
                      <ProfileAvatar name={p.name} color={p.avatar_color} avatarUrl={p.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-slate-200 truncate">{p.name}</p>
                        {p.email && <p className="text-slate-600 truncate">{p.email}</p>}
                      </div>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'
                        }`}
                      >
                        {checked && <Check size={9} className="text-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveShares}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-[#050505] font-medium rounded-lg px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
