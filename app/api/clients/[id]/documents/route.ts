import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Lista documentos do cliente
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('client_documents')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * Confirma o upload após o browser enviar o arquivo direto ao R2.
 * Recebe JSON com { r2_key, name, size, mime_type } e salva no banco.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { r2_key, name, size, mime_type } = await request.json()

  if (!r2_key || !name || !size || !mime_type) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_documents')
    .insert({
      client_id: id,
      name,
      size,
      mime_type,
      r2_key,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
