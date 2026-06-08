'use client'

import { useRef, useState } from 'react'
import type { Profile } from '@/lib/types'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/ToastProvider'
import { Camera, Loader2, Check, Phone, FileText, Palette, User, Cake } from 'lucide-react'

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

interface ProfileEditorProps {
  profile: Profile | null
  userId: string
}

export default function ProfileEditor({ profile: initial, userId }: ProfileEditorProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile>(
    initial ?? {
      id: userId,
      name: '',
      email: null,
      avatar_color: '#6366f1',
      avatar_url: null,
      bio: null,
      phone: null,
      birth_date: null,
      role: 'member',
      created_at: '',
      updated_at: '',
    }
  )

  const [form, setForm] = useState({
    name: profile.name ?? '',
    phone: profile.phone ?? '',
    bio: profile.bio ?? '',
    birth_date: profile.birth_date ?? '',
    avatar_color: profile.avatar_color ?? '#6366f1',
  })

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast('Imagem muito grande. Máximo 5MB.')
      return
    }
    setUploadFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function uploadAvatar(): Promise<string | null> {
    if (!uploadFile) return profile.avatar_url ?? null
    setUploadingPhoto(true)

    const supabase = createClient()
    const ext = uploadFile.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/avatar.${ext}`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, uploadFile, { upsert: true, contentType: uploadFile.type })

    if (error) {
      toast('Erro ao enviar foto: ' + error.message)
      setUploadingPhoto(false)
      return profile.avatar_url ?? null
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    // Bust cache by adding timestamp
    const bustedUrl = `${publicUrl}?t=${Date.now()}`
    setUploadingPhoto(false)
    return bustedUrl
  }

  async function handleSave() {
    if (!form.name.trim()) { toast('Nome é obrigatório'); return }
    setSaving(true)

    const avatarUrl = await uploadAvatar()

    const res = await fetch(`/api/profiles/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        birth_date: form.birth_date || null,
        avatar_color: form.avatar_color,
        avatar_url: avatarUrl,
      }),
    })

    if (res.ok) {
      const updated = await res.json()
      setProfile(updated)
      setUploadFile(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast('Perfil salvo!')
    } else {
      toast('Erro ao salvar perfil.')
    }

    setSaving(false)
  }

  const displayUrl = previewUrl ?? profile.avatar_url

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Meu Perfil</h1>
        <p className="text-slate-400 text-sm mt-1">Gerencie suas informações pessoais</p>
      </div>

      {/* ── Foto + identidade ── */}
      <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl px-6 py-6 mb-4">
        <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-5">
          <User size={12} /> Foto e identidade
        </h2>

        <div className="flex items-center gap-6">
          {/* Avatar com botão de upload */}
          <div className="relative group flex-shrink-0">
            <ProfileAvatar
              name={form.name || '?'}
              color={form.avatar_color}
              avatarUrl={displayUrl}
              size="xl"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Trocar foto"
            >
              {uploadingPhoto ? (
                <Loader2 size={20} className="text-white animate-spin" />
              ) : (
                <Camera size={20} className="text-white" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base">{profile.name || 'Sem nome'}</p>
            <p className="text-slate-400 text-sm mt-0.5">{profile.email}</p>
            <p className="text-slate-500 text-xs mt-1">{ROLE_LABEL[profile.role] ?? profile.role}</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
            >
              <Camera size={11} />
              {displayUrl ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {uploadFile && (
              <p className="text-xs text-emerald-400 mt-1.5">
                ✓ Nova foto selecionada — clique em Salvar para aplicar
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Informações pessoais ── */}
      <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl px-6 py-6 mb-4">
        <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-5">
          <FileText size={12} /> Informações pessoais
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Nome completo *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Seu nome"
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">E-mail</label>
            <input
              type="email"
              value={profile.email ?? ''}
              disabled
              className="w-full bg-[#050505] border border-slate-800 text-slate-500 rounded-lg px-3 py-2.5 text-sm cursor-not-allowed"
            />
            <p className="text-slate-600 text-xs mt-1">O e-mail não pode ser alterado aqui.</p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
              <Phone size={10} /> Telefone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+55 (11) 99999-9999"
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1">
              <Cake size={10} /> Data de nascimento
            </label>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))}
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              rows={3}
              placeholder="Fale um pouco sobre você..."
              className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* ── Aparência ── */}
      <div className="bg-[#1a1a1d] border border-slate-700 rounded-xl px-6 py-6 mb-6">
        <h2 className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-4">
          <Palette size={12} /> Cor do avatar
        </h2>
        <p className="text-slate-500 text-xs mb-4">
          Exibida quando não há foto de perfil.
        </p>
        <div className="flex gap-3 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm((p) => ({ ...p, avatar_color: c }))}
              className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                form.avatar_color === c
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1d] scale-110'
                  : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* ── Save ── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
      >
        {saving ? (
          <><Loader2 size={14} className="animate-spin" /> Salvando...</>
        ) : saved ? (
          <><Check size={14} /> Salvo!</>
        ) : (
          'Salvar alterações'
        )}
      </button>
    </div>
  )
}
