import { createClient } from '@/lib/supabase/server'
import { r2, R2_BUCKET } from '@/lib/r2'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextResponse } from 'next/server'

// Gera URL assinada para download ou preview do anexo de uma mensagem
// ?preview=true → disposition inline (para exibir no browser)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { data: message, error } = await supabase
    .from('inbox_messages')
    .select('attachment_r2_key, attachment_name')
    .eq('id', id)
    .single()

  if (error || !message || !message.attachment_r2_key) {
    return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })
  }

  const isPreview = new URL(request.url).searchParams.get('preview') === 'true'
  const filename = message.attachment_name ?? 'arquivo'

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: message.attachment_r2_key,
      ResponseContentDisposition: isPreview
        ? `inline; filename="${encodeURIComponent(filename)}"`
        : `attachment; filename="${encodeURIComponent(filename)}"`,
    }),
    { expiresIn: 3600 }
  )

  return NextResponse.json({ url })
}
