'use client'

/**
 * Página de aterrissagem para links de convite.
 *
 * O Supabase redireciona para cá após verificar o token do convite.
 * O createBrowserClient já tem detectSessionInUrl: true por padrão,
 * então ele processa o ?code= (PKCE) ou #access_token= (hash) automaticamente
 * ao ser instanciado — NÃO chamamos exchangeCodeForSession manualmente para
 * não consumir o code duas vezes (o que causava erro de "Link inválido").
 *
 * Fluxo:
 *  1. SDK processa a URL e dispara SIGNED_IN
 *  2. onAuthStateChange captura e redireciona para /set-password (novo usuário)
 *     ou para / (usuário já existente)
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
    let done = false

    function go(user: { created_at?: string }) {
      if (done) return
      done = true
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0
      const isNewUser = Date.now() - createdAt < 24 * 60 * 60 * 1000
      router.replace(isNewUser ? '/set-password' : '/')
    }

    // Assina ANTES de qualquer verificação assíncrona.
    // O SDK auto-processa ?code= ou #access_token= e dispara SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        subscription.unsubscribe()
        go(session.user)
      }
    })

    // Fallback imediato: sessão pode já estar pronta se o SDK foi rápido
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe()
        go(session.user)
      }
    })

    // Timeout de segurança — se em 10 s nenhuma sessão aparecer, link inválido
    const timer = setTimeout(() => {
      if (!done) {
        subscription.unsubscribe()
        setErrorMsg('Link de convite inválido, já utilizado ou expirado.')
      }
    }, 10_000)

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
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
