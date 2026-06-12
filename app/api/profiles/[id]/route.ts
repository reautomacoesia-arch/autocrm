import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { profileUpdateSchema } from '@/lib/api/schemas'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, profileUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Admin pode editar qualquer perfil; outros só o próprio
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = myProfile?.role === 'admin'
  if (user.id !== id && !isAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined)         fields.name = body.name
  if (body.avatar_color !== undefined) fields.avatar_color = body.avatar_color
  if (body.avatar_url !== undefined)   fields.avatar_url = body.avatar_url ?? null
  if (body.bio !== undefined)          fields.bio = body.bio ?? null
  if (body.birth_date !== undefined)   fields.birth_date = body.birth_date ?? null
  if (body.phone !== undefined)        fields.phone = body.phone ?? null
  if (body.role !== undefined) {
    // Apenas admins podem alterar papéis — impede auto-promoção a admin
    if (!isAdmin) {
      return NextResponse.json({ error: 'Apenas admins podem alterar papéis.' }, { status: 403 })
    }
    fields.role = body.role
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  if (user.id === id) {
    return NextResponse.json(
      { error: 'Você não pode remover sua própria conta.' },
      { status: 400 },
    )
  }

  // Apenas admins podem remover colaboradores
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (myProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas admins podem remover colaboradores.' }, { status: 403 })
  }

  // Deletar usuário no Supabase Auth (cascata apaga o profile via FK)
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
