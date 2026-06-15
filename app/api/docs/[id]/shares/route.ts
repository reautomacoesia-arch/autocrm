import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { docSharesSchema } from '@/lib/api/schemas'

// Lista os user_ids com quem o documento está compartilhado especificamente
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('workspace_doc_shares')
    .select('user_id')
    .eq('doc_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((row) => row.user_id))
}

// Substitui o conjunto de compartilhamentos do documento (apenas o dono, via RLS)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const parsed = await parseBody(request, docSharesSchema)
  if (!parsed.ok) return parsed.response

  // Exclui o próprio dono da lista — ele já tem acesso ao documento
  const userIds = Array.from(new Set(parsed.data.user_ids.filter((uid) => uid !== user.id)))

  const { error: deleteError } = await supabase
    .from('workspace_doc_shares')
    .delete()
    .eq('doc_id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (userIds.length > 0) {
    const { error: insertError } = await supabase
      .from('workspace_doc_shares')
      .insert(userIds.map((uid) => ({ doc_id: id, user_id: uid })))

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ user_ids: userIds })
}
