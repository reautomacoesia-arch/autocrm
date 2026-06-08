import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Verify caller is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Verify caller is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas admins podem convidar colaboradores.' }, { status: 403 })
  }

  const body = await request.json()
  const email: string = (body.email ?? '').trim().toLowerCase()
  const name: string = (body.name ?? '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }

  // mode: 'email' (padrão) — Supabase envia e-mail automaticamente
  //        'link'          — gera link sem enviar e-mail; retorna URL para copiar
  const mode: 'email' | 'link' = body.mode === 'link' ? 'link' : 'email'
  // Aponta para /auth/callback que troca o code por sessão.
  // O domínio base DEVE estar na lista "Redirect URLs" do Supabase Dashboard
  // (Authentication → URL Configuration → Redirect URLs → adicionar https://autocrm-olive.vercel.app/**)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://autocrm-olive.vercel.app').replace(/\/$/, '')
  const redirectTo = `${siteUrl}/auth/callback`

  try {
    const admin = createAdminClient()

    if (mode === 'link') {
      // Gera link de convite sem enviar e-mail
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          data: { name: name || email.split('@')[0] },
          redirectTo,
        },
      })

      if (error) {
        if (error.message.toLowerCase().includes('already')) {
          return NextResponse.json({ error: 'Este e-mail já possui uma conta.' }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (data.user) {
        await admin.from('profiles').upsert({
          id: data.user.id,
          email,
          name: name || email.split('@')[0],
          avatar_color: '#6366f1',
          role: 'member',
        }, { onConflict: 'id' })
      }

      return NextResponse.json({
        success: true,
        userId: data.user?.id ?? null,
        link: (data as any).properties?.action_link ?? null,
      })
    }

    // mode === 'email': comportamento original
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name: name || email.split('@')[0] },
      redirectTo,
    })

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        return NextResponse.json({ error: 'Este e-mail já possui uma conta.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (data.user) {
      await admin.from('profiles').upsert({
        id: data.user.id,
        email,
        name: name || email.split('@')[0],
        avatar_color: '#6366f1',
        role: 'member',
      }, { onConflict: 'id' })
    }

    return NextResponse.json({ success: true, userId: data.user?.id ?? null })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao processar convite.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
