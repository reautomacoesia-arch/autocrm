'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#050505' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: '#D4AF37' }}
          >
            <span className="font-heading font-black text-2xl" style={{ color: '#050505' }}>K</span>
          </div>
          <h1 className="font-heading font-black uppercase tracking-widest text-white text-xl">
            KORVUS AI
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Entre na sua conta
          </p>
        </div>

        <div className="rounded-3xl p-8" style={{
          background: '#1A1A1D',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
        }}>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-heading font-bold uppercase text-xs tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="login-input w-full text-white rounded-xl px-4 py-3 text-sm outline-none"
                placeholder="voce@empresa.com"
              />
            </div>

            <div>
              <label className="block font-heading font-bold uppercase text-xs tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="login-input w-full text-white rounded-xl px-4 py-3 text-sm outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm rounded-xl px-4 py-3" style={{
                color: '#fca5a5',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-heading font-black uppercase rounded-xl px-4 py-3 text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
              style={{
                background: '#D4AF37',
                color: '#050505',
                letterSpacing: '0.1em',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
