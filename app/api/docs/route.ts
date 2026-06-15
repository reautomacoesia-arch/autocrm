import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { docCreateSchema } from '@/lib/api/schemas'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rootOnly = new URL(request.url).searchParams.get('root') === '1'

  let query = supabase
    .from('workspace_docs')
    .select('id, title, visibility, created_by, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (rootOnly) query = query.is('parent_id', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const parsed = await parseBody(request, docCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('workspace_docs')
    .insert({
      title: body.title ?? 'Sem título',
      visibility: body.visibility ?? 'personal',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('POST /api/docs insert error:', JSON.stringify(error))
    return NextResponse.json({ error: error.message, code: error.code, details: error.details, hint: error.hint }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
