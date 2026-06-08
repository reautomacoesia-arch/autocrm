'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

// Mensagens amigáveis para erros que o Supabase manda no hash da URL
// Ex: /login#error=access_denied&error_code=otp_expired
const HASH_ERROR_MESSAGES: Record<string, string> = {
  otp_expired: 'O link de convite expirou. Peça ao administrador um novo link.',
  access_denied: 'Acesso negado. O link pode ter sido usado ou expirado.',
  email_not_confirmed: 'E-mail ainda não confirmado.',
  user_not_found: 'Usuário não encontrado.',
}

function getHashError(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  const params = new URLSearchParams(hash)
  const code = params.get('error_code')
  const desc = params.get('error_description')
  if (!code && !desc) return null
  return HASH_ERROR_MESSAGES[code ?? ''] ?? decodeURIComponent((desc ?? '').replace(/\+/g, ' '))
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hashError, setHashError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Detecta erros vindos do hash da URL (ex: link de convite expirado)
  useEffect(() => {
    setHashError(getHashError())
    // Limpa o hash da URL sem recarregar a página
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
          <span className="text-white text-xl font-bold">⚡</span>
        </div>
        <h1 className="text-white text-2xl font-bold">KORVUS CRM</h1>
        <p className="text-slate-400 text-sm mt-1">Entre na sua conta</p>
      </div>

      {/* Erro vindo de link expirado ou inválido */}
      {hashError && (
        <div className="flex items-start gap-3 text-amber-300 bg-amber-900/20 border border-amber-800 rounded-lg px-4 py-3 mb-4 text-sm">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{hashError}</span>
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="voce@empresa.com"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Senha
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#050505] font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
