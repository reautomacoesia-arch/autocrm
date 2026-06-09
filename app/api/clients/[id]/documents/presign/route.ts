import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'

/**
 * Gera uma URL assinada para upload direto ao R2.
 * O browser faz PUT nessa URL, evitando o limite de 4.5 MB do Vercel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { name, size, mime_type } = await request.json()

  if (!name || !size || !mime_type) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const MAX_SIZE = 500 * 1024 * 1024 // 500 MB
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 500 MB.' }, { status: 413 })
  }

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2_key = `${id}/${crypto.randomUUID()}-${safeName}`

  const upload_url = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: r2_key,
      ContentType: mime_type,
    }),
    { expiresIn: 3600 } // URL válida por 1h
  )

  return NextResponse.json({ upload_url, r2_key })
}
