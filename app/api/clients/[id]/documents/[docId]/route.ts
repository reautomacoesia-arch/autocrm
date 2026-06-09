import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'

// Gera URL assinada para download
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { docId } = await params
  const { data: doc, error } = await supabase
    .from('client_documents')
    .select('r2_key, name')
    .eq('id', docId)
    .single()

  if (error || !doc) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: doc.r2_key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(doc.name)}"`,
    }),
    { expiresIn: 3600 } // 1 hora
  )

  return NextResponse.json({ url })
}

// Deleta documento (R2 + DB)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { docId } = await params
  const { data: doc, error: fetchError } = await supabase
    .from('client_documents')
    .select('r2_key')
    .eq('id', docId)
    .single()

  if (fetchError || !doc) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })

  // Remove do R2
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: doc.r2_key }))
  } catch (err) {
    console.error('R2 delete error:', err)
  }

  // Remove do banco
  const { error } = await supabase.from('client_documents').delete().eq('id', docId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
