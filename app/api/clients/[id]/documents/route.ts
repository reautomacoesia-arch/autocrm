import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
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

// Upload de novo documento
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })

  const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 50 MB.' }, { status: 413 })
  }

  // Chave única no R2: <client_id>/<uuid>-<nome_original>
  const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${id}/${crypto.randomUUID()}${ext ? `-${safeName}` : ''}`

  const arrayBuffer = await file.arrayBuffer()

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: file.type || 'application/octet-stream',
      })
    )
  } catch (err) {
    console.error('R2 upload error:', err)
    return NextResponse.json({ error: 'Erro ao enviar para o armazenamento.' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('client_documents')
    .insert({
      client_id: id,
      name: file.name,
      size: file.size,
      mime_type: file.type || 'application/octet-stream',
      r2_key: key,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (error) {
    // Tenta limpar o arquivo do R2 se o DB falhar
    try {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    } catch {}
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
