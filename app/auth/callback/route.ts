import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 'type=invite' é passado via query string pelo nosso invite route
  const type = searchParams.get('type')

  if (code) {
    // Captura todos os cookies que o Supabase quer definir durante a troca
    // do PKCE code por sessão. NÃO usamos o wrapper de server.ts aqui porque
    // cookies().set() do next/headers NÃO é incluído em NextResponse.redirect().
    // Em vez disso, coletamos e aplicamos manualmente no redirect response.
    const cookiesToApply: { name: string; value: string; options: Record<string, unknown> }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Guarda para aplicar no response depois
            cookiesToApply.push(...cookiesToSet)
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // Token expirado, já usado, etc.
      return NextResponse.redirect(`${origin}/login?error=invite_expired`)
    }

    let redirectUrl = `${origin}/`

    if (type === 'invite') {
      // Proteção: só vai para /set-password se for usuário novo (< 24h).
      // Evita que admin clicando em link de teste redefina sua própria senha.
      const { data: { user } } = await supabase.auth.getUser()
      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0
      const isNewUser = Date.now() - createdAt < 24 * 60 * 60 * 1000

      redirectUrl = isNewUser ? `${origin}/set-password` : `${origin}/`
    }

    // Cria o redirect e aplica os cookies de sessão explicitamente.
    // Sem isso, a sessão do Supabase não chega ao browser.
    const response = NextResponse.redirect(redirectUrl)
    cookiesToApply.forEach(({ name, value, options }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.cookies.set(name, value, options as any)
    })
    return response
  }

  return NextResponse.redirect(`${origin}/`)
}
