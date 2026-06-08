'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Carrega o nome do usuário convidado (se disponível no metadata)
  useEffect(() => {
    // getSession() lê direto dos cookies — não faz request extra à rede.
    // Mais confiável após navegação window.location.href vinda de /invite.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null

      if (!user) {
        // Sem sessão válida — manda pro login
        router.replace('/login')
        return
      }

      // Proteção: se o usuário já existe há mais de 24h, não é um convidado novo.
      // Redireciona pro dashboard para evitar que um admin redefina sua própria senha.
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
      const isNewUser = Date.now() - createdAt < 24 * 60 * 60 * 1000
      if (!isNewUser) {
        router.replace('/')
        return
      }

      const name =
        user.user_metadata?.name ??
        user.email?.split('@')[0] ??
        null
      setUserName(name)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Senha definida com sucesso — entra no app
    router.push('/')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
          <KeyRound size={22} className="text-white" />
        </div>
        <h1 className="text-white text-2xl font-bold">
          {userName ? `Bem-vindo, ${userName.split(' ')[0]}!` : 'Bem-vindo!'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Crie uma senha para acessar o Korvus CRM
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Nova senha
          </label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              minLength={8}
              className="w-full bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors pr-10"
              placeholder="Mínimo 8 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              tabIndex={-1}
            >
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Confirmar senha
          </label>
          <input
            type={showPwd ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className={`w-full bg-[#1a1a1d] border text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors ${
              confirm && confirm !== password
                ? 'border-red-700 focus:border-red-500'
                : 'border-slate-700 focus:border-indigo-500'
            }`}
            placeholder="Repita a senha"
          />
          {confirm && confirm !== password && (
            <p className="text-red-400 text-xs mt-1">As senhas não coincidem</p>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || password !== confirm || password.length < 8}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#050505] font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
        >
          {loading ? 'Salvando...' : 'Confirmar e entrar'}
        </button>
      </form>

      <p className="text-center text-slate-600 text-xs mt-6">
        Ao criar a senha você confirma que aceita o acesso ao Korvus CRM.
      </p>
    </div>
  )
}
