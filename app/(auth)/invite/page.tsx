'use client'

/**
 * Página de aterrissagem para links de convite.
 *
 * O Supabase redireciona para cá após verificar o token do convite.
 * Ele pode usar dois formatos:
 *   • PKCE  — ?code=CODE   (query param, visível no servidor)
 *   • Hash  — #access_token=... (fragmento, só visível no browser)
 *
 * Como esta é uma página client-side, o SDK do Supabase no browser
 * detecta ambos os casos automaticamente via detectSessionInUrl.
 * Após a sessão ser estabelecida, redireciona para /set-password
 * (usuários novos) ou para / (usuários já existentes).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function InviteConfirmPage() {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let redirected = false

    function go(user: { created_at?: string }) {
      if (redirected) return
      redirected = true
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
      const isNewUser = Date.now() - createdAt < 24 * 60 * 60 * 1000
      router.replace(isNewUser ? '/set-password' : '/')
    }

    async function init() {
      // Caso PKCE: ?code= na URL — exchange manual
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setErrorMsg('Link de convite inválido ou já utilizado.')
          return
        }
        if (data.session) { go(data.session.user); return }
      }

      // Caso Hash: #access_token= — SDK detecta automaticamente
      // Já pode estar pronto:
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { go(session.user); return }

      // Se ainda não tem sessão, aguarda o evento de auth
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          subscription.unsubscribe()
          go(session.user)
        }
      })

      // Timeout de segurança — 6 s
      setTimeout(() => {
        if (!redirected) {
          subscription.unsubscribe()
          setErrorMsg('Link de convite inválido, já utilizado ou expirado.')
        }
      }, 6000)
    }

    init()
  }, [router])

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
