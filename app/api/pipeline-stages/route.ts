import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { pipelineStageCreateSchema } from '@/lib/api/schemas'
import { slugifyStage } from '@/lib/pipeline'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const parsed = await parseBody(request, pipelineStageCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // Gera um slug único a partir do label (slugify + sufixo numérico se colidir)
  const baseSlug = slugifyStage(body.label)
  let slug = baseSlug
  let suffix = 1
  while (true) {
    const { data: existing } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    suffix += 1
    slug = `${baseSlug}_${suffix}`
  }

  // Próxima posição = max(position) + 1
  const { data: maxRow } = await supabase
    .from('pipeline_stages')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (maxRow?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      slug,
      label: body.label,
      color: body.color ?? '#64748b',
      type: body.type ?? 'open',
      probability: body.probability ?? 0.3,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
