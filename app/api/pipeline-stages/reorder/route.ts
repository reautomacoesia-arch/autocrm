import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { pipelineStageReorderSchema } from '@/lib/api/schemas'

export async function POST(request: Request) {
  const supabase = await createClient()
  const parsed = await parseBody(request, pipelineStageReorderSchema)
  if (!parsed.ok) return parsed.response
  const { ids } = parsed.data

  // Atualiza a posição de cada estágio conforme a ordem recebida
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase.from('pipeline_stages').update({ position: index }).eq('id', id)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
