import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Lista páginas de um caderno
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('workspace_docs')
    .select('id, title, created_at, updated_at')
    .eq('parent_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Cria uma nova página dentro do caderno
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  // Herda a visibilidade do caderno pai
  const { data: parent } = await supabase
    .from('workspace_docs')
    .select('visibility')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('workspace_docs')
    .insert({
      title: body.title ?? 'Nova página',
      parent_id: id,
      visibility: parent?.visibility ?? 'personal',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
