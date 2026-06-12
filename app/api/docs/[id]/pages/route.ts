import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { docPageCreateSchema, docPagesReorderSchema } from '@/lib/api/schemas'

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
    .order('position', { ascending: true })
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
  const parsed = await parseBody(request, docPageCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

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

// Reordena páginas do caderno
// Body: { order: string[] } — array de IDs na nova ordem
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const parsedOrder = await parseBody(request, docPagesReorderSchema)
  if (!parsedOrder.ok) return parsedOrder.response
  const { order } = parsedOrder.data

  // Atualiza position de cada página em paralelo
  await Promise.all(
    order.map((pageId: string, idx: number) =>
      supabase
        .from('workspace_docs')
        .update({ position: idx })
        .eq('id', pageId)
        .eq('parent_id', id)
    )
  )

  return NextResponse.json({ ok: true })
}
