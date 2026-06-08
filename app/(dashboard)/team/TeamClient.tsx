'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/types'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { useToast } from '@/components/ui/ToastProvider'
import { Pencil, Check, X, UserPlus, Mail, Send, Loader2 } from 'lucide-react'

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

  const { toast } = useToast()

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
    setShowInvite(true)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError(null)

    const res = await fetch('/api/profiles/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName }),
    })

    const data = await res.json()

    if (!res.ok) {
      setInviteError(data.error ?? 'Erro ao enviar convite.')
      setInviteLoading(false)
      return
    }

    setInviteSent(true)
    setInviteLoading(false)

    // Add placeholder profile to the list so it shows up immediately
    const placeholder: Profile = {
      id: `pending-${Date.now()}`,
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
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check size={22} className="text-emerald-400" />
                    </div>
                    <p className="text-white font-medium text-sm mb-1">Convite enviado!</p>
                    <p className="text-slate-400 text-xs">
                      Um e-mail foi enviado para{' '}
                      <span className="text-indigo-400">{inviteEmail}</span> com o link de acesso.
                    </p>
                    <div className="flex gap-2 mt-5">
                      <button
                        onClick={() => { setInviteSent(false); setInviteEmail(''); setInviteName('') }}
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
                  <form onSubmit={handleInvite} className="space-y-4">
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

                    <p className="text-slate-600 text-xs leading-relaxed">
                      A pessoa receberá um e-mail com link para criar sua senha e acessar o CRM.
                      O perfil dela ficará disponível para atribuição de tarefas imediatamente.
                    </p>

                    {inviteError && (
                      <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                        {inviteError}
                      </p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowInvite(false)}
                        className="flex-1 border border-slate-700 text-slate-400 rounded-lg py-2 text-sm hover:bg-slate-800 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={inviteLoading}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {inviteLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        {inviteLoading ? 'Enviando...' : 'Enviar convite'}
                      </button>
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
                  {isMe && !isPending && (
                    <button
                      onClick={() => startEdit(p)}
                      className="text-slate-600 hover:text-indigo-400 transition-colors p-1.5"
                      title="Editar perfil"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
