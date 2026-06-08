'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/types'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { useToast } from '@/components/ui/ToastProvider'
import { Pencil, Check, X, UserPlus, Mail, Send, Loader2, Link2, Copy, CheckCheck, UserMinus } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmModal'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#d4af37', '#64748b',
]

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Visualizador',
}

interface TeamClientProps {
  profiles: Profile[]
  currentUserId: string
}

export default function TeamClient({ profiles: initial, currentUserId }: TeamClientProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editRole, setEditRole] = useState('')

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { toast } = useToast()
  const confirm = useConfirm()

  const me = profiles.find((p) => p.id === currentUserId)
  const isAdmin = me?.role === 'admin'

  function startEdit(p: Profile) {
    setEditingId(p.id)
    setEditName(p.name)
    setEditColor(p.avatar_color)
    setEditRole(p.role)
  }

  function cancelEdit() { setEditingId(null) }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, avatar_color: editColor, role: editRole }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)))
      toast('Perfil atualizado')
    } else {
      toast('Erro ao salvar')
    }
    setEditingId(null)
  }

  function openInvite() {
    setInviteEmail('')
    setInviteName('')
    setInviteError(null)
    setInviteSent(false)
    setInviteLink(null)
    setCopied(false)
    setShowInvite(true)
  }

  async function doInvite(mode: 'email' | 'link') {
    setInviteLoading(true)
    setInviteError(null)

    const res = await fetch('/api/profiles/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName, mode }),
    })

    const data = await res.json()

    if (!res.ok) {
      setInviteError(data.error ?? 'Erro ao processar convite.')
      setInviteLoading(false)
      return
    }

    setInviteSent(true)
    if (data.link) setInviteLink(data.link)
    setInviteLoading(false)

    // Adiciona placeholder na lista imediatamente (usa userId real se disponível)
    const placeholder: Profile = {
      id: data.userId ?? `pending-${Date.now()}`,
      name: inviteName || inviteEmail.split('@')[0],
      email: inviteEmail,
      avatar_color: '#64748b',
      avatar_url: null,
      bio: null,
      phone: null,
      birth_date: null,
      role: 'member',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setProfiles((prev) => [...prev, placeholder])
  }

  function handleInviteEmail(e: React.FormEvent) {
    e.preventDefault()
    doInvite('email')
  }

  async function handleRemoveMember(id: string, name: string) {
    const isPendingLocal = id.startsWith('pending-')
    const ok = await confirm({
      title: isPendingLocal ? 'Cancelar convite?' : `Remover ${name}?`,
      description: isPendingLocal
        ? 'O convite será cancelado e o acesso revogado.'
        : 'O acesso será revogado imediatamente. Esta ação não pode ser desfeita.',
      destructive: true,
      confirmLabel: isPendingLocal ? 'Cancelar convite' : 'Remover',
    })
    if (!ok) return

    // Placeholder local sem ID real — só remove da lista
    if (isPendingLocal) {
      setProfiles((prev) => prev.filter((p) => p.id !== id))
      toast('Convite removido da lista')
      return
    }

    const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setProfiles((prev) => prev.filter((p) => p.id !== id))
      toast('Colaborador removido')
    } else {
      const data = await res.json()
      toast(data.error ?? 'Erro ao remover', 'error')
    }
  }

  async function copyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Equipe</h1>
          <p className="text-slate-400 text-sm mt-1">
            {profiles.length} colaborador{profiles.length !== 1 ? 'es' : ''}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openInvite}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-[#050505] font-medium text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <UserPlus size={15} />
            Convidar colaborador
          </button>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowInvite(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1d] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-indigo-400" />
                  <h2 className="text-white font-semibold text-sm">Convidar colaborador</h2>
                </div>
                <button onClick={() => setShowInvite(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-6 py-5">
                {inviteSent ? (
                  /* ── Success state ── */
                  <div className="py-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-emerald-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check size={18} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {inviteLink ? 'Link gerado!' : 'Convite enviado!'}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {inviteLink
                            ? 'Copie o link abaixo e envie pelo canal que preferir.'
                            : `E-mail enviado para ${inviteEmail}`}
                        </p>
                      </div>
                    </div>

                    {inviteLink && (
                      <div className="mb-4">
                        <p className="text-slate-500 text-xs mb-2">Link de acesso (uso único):</p>
                        <div className="flex gap-2">
                          <input
                            readOnly
                            value={inviteLink}
                            className="flex-1 bg-[#050505] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none truncate"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <button
                            onClick={copyLink}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                              copied
                                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-800'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
                            {copied ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                        <p className="text-slate-600 text-xs mt-2">
                          Cole no WhatsApp, e-mail ou qualquer canal. O link expira após o primeiro uso.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setInviteSent(false)
                          setInviteEmail('')
                          setInviteName('')
                          setInviteLink(null)
                          setCopied(false)
                        }}
                        className="flex-1 border border-slate-700 text-slate-400 rounded-lg py-2 text-sm hover:bg-slate-800 transition-colors"
                      >
                        Convidar outro
                      </button>
                      <button
                        onClick={() => setShowInvite(false)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Form ── */
                  <form onSubmit={handleInviteEmail} className="space-y-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">Nome (opcional)</label>
                      <input
                        type="text"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Ex: João Silva"
                        className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5">E-mail *</label>
                      <input
                        type="email"
                        required
                        autoFocus
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colaborador@empresa.com"
                        className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                      />
                    </div>

                    {inviteError && (
                      <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                        {inviteError}
                      </p>
                    )}

                    {/* Dois modos de convite */}
                    <div className="pt-1 space-y-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={inviteLoading || !inviteEmail}
                          onClick={() => doInvite('link')}
                          className="flex-1 flex items-center justify-center gap-1.5 border border-slate-600 hover:border-indigo-600 text-slate-300 hover:text-indigo-400 disabled:opacity-40 rounded-lg py-2 text-sm transition-colors"
                        >
                          {inviteLoading ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                          Gerar link
                        </button>
                        <button
                          type="submit"
                          disabled={inviteLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors"
                        >
                          {inviteLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          {inviteLoading ? 'Aguarde...' : 'Enviar por e-mail'}
                        </button>
                      </div>
                      <p className="text-slate-700 text-xs text-center">
                        Link = você copia e manda onde quiser · E-mail = Supabase envia automaticamente
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Team list */}
      <div className="grid grid-cols-1 gap-3 max-w-2xl">
        {profiles.map((p) => {
          const isMe = p.id === currentUserId
          const isEditing = editingId === p.id
          const isPending = p.id.startsWith('pending-')

          return (
            <div
              key={p.id}
              className={`bg-[#1a1a1d] border rounded-xl px-5 py-4 ${
                isPending ? 'border-slate-700/50 opacity-60' : 'border-slate-700'
              }`}
            >
              {isEditing ? (
                /* ── Edit mode ── */
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={editName || '?'} color={editColor} avatarUrl={null} size="lg" />
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-[#050505] border border-indigo-500 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                      placeholder="Seu nome"
                    />
                  </div>

                  <div>
                    <p className="text-slate-500 text-xs mb-2">Cor do avatar</p>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                            editColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1a1a1d]' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-slate-500 text-xs mb-1.5">Cargo</p>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Membro</option>
                      <option value="viewer">Visualizador</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(p.id)}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Check size={12} /> Salvar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 text-slate-400 border border-slate-700 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex items-center gap-4">
                  <ProfileAvatar name={p.name || '?'} color={p.avatar_color} avatarUrl={p.avatar_url} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium text-sm">{p.name}</p>
                      {isMe && (
                        <span className="text-[10px] bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded-full">
                          Você
                        </span>
                      )}
                      {isPending && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full">
                          Convite pendente
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{p.email}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{ROLE_LABEL[p.role] ?? p.role}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isMe && !isPending && (
                      <button
                        onClick={() => startEdit(p)}
                        className="text-slate-600 hover:text-indigo-400 transition-colors p-1.5"
                        title="Editar perfil"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {isAdmin && !isMe && (
                      <button
                        onClick={() => handleRemoveMember(p.id, p.name)}
                        className="text-slate-700 hover:text-red-400 transition-colors p-1.5"
                        title={isPending ? 'Cancelar convite' : 'Remover colaborador'}
                      >
                        <UserMinus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
