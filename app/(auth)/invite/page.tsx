'use client'

/**
 * Página de aterrissagem para links de convite.
 *
 * O Supabase pode redirecionar para cá com três formatos diferentes:
 *   1. ?code=CODE          — PKCE (mais comum, auto-processado pelo SDK)
 *   2. ?token_hash=HASH    — OTP hash (formato mais novo do Supabase)
 *   3. #access_token=...   — Implicit flow (auto-processado pelo SDK)
 *
 * Após estabelecer a sessão, usa window.location.href (navegação completa)
 * ao invés de router.replace para garantir que os cookies de sessão
 * sejam enviados corretamente na próxima requisição.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function InviteConfirmPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let done = false

    function go(user: { created_at?: string }) {
      if (done) return
      done = true
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
      const isNewUser = Date.now() - createdAt < 24 * 60 * 60 * 1000
      // Navegação COMPLETA (não client-side) para garantir que os cookies
      // de sessão sejam enviados junto com a próxima requisição
      window.location.href = isNewUser ? '/set-password' : '/'
    }

    async function tryEstablishSession() {
      const params = new URLSearchParams(window.location.search)

      // Formato 1: ?token_hash= (novo formato OTP do Supabase)
      const tokenHash = params.get('token_hash')
      if (tokenHash) {
        const type = (params.get('type') ?? 'invite') as 'invite'
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        if (!error && data.session) { go(data.session.user); return }
        if (error) { setErrorMsg('Link de convite inválido ou expirado.'); return }
      }

      // Formato 2: ?code= (PKCE) — o SDK auto-processa, mas aguardamos via onAuthStateChange
      // Formato 3: #access_token= (implicit) — o SDK auto-processa também

      // Aguarda o SDK processar a URL (detectSessionInUrl: true)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          subscription.unsubscribe()
          go(session.user)
        }
      })

      // Fallback: verifica se o SDK já processou antes de subscriberrmos
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        subscription.unsubscribe()
        go(session.user)
        return
      }

      // Timeout de segurança — 10 s
      setTimeout(() => {
        if (!done) {
          subscription.unsubscribe()
          setErrorMsg('Link de convite inválido, já utilizado ou expirado.')
        }
      }, 10_000)
    }

    tryEstablishSession()
  }, [])

  if (errorMsg) {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="text-4xl">🔗</div>
        <p className="text-white font-semibold">Link inválido</p>
        <p className="text-slate-400 text-sm">{errorMsg}</p>
        <a
          href="/login"
          className="inline-block mt-2 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          Ir para o login
        </a>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4">
      <Loader2 size={28} className="text-indigo-400 animate-spin" />
      <p className="text-slate-400 text-sm">Verificando convite…</p>
    </div>
  )
}
