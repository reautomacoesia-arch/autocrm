import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 'type=invite' é passado pelo nosso invite route para sinalizar que
  // o usuário deve definir uma senha antes de acessar o app.
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    // Se a troca falhou (token expirado, já usado, etc.) manda pro login
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=invite_expired`)
    }

    // Proteção: só redireciona para set-password se for um usuário
    // recém-criado (< 24h). Evita que um admin logado mude sua própria
    // senha por engano ao testar um link de convite no mesmo navegador.
    if (type === 'invite') {
      const { data: { user } } = await supabase.auth.getUser()
      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0
      const isNewUser = Date.now() - createdAt < 24 * 60 * 60 * 1000 // 24h

      if (isNewUser) {
        return NextResponse.redirect(`${origin}/set-password`)
      }

      // Usuário antigo clicou num link de convite — vai pro dashboard normalmente
      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
