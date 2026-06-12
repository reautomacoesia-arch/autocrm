import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { presignSchema, isAllowedMimeType, sanitizeFileName } from '@/lib/api/upload'
import { rateLimit } from '@/lib/api/rate-limit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const limited = rateLimit(request, 'inbox-presign', { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const { id } = await params
  const parsed = await parseBody(request, presignSchema)
  if (!parsed.ok) return parsed.response
  const { name, mime_type } = parsed.data

  if (!isAllowedMimeType(mime_type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 415 })
  }

  const safeName = sanitizeFileName(name)
  const r2_key = `inbox/${id}/${crypto.randomUUID()}-${safeName}`

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
