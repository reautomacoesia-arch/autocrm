import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { pipelineStageUpdateSchema } from '@/lib/api/schemas'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, pipelineStageUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const fields: Record<string, unknown> = {}
  if (body.label !== undefined) fields.label = body.label
  if (body.color !== undefined) fields.color = body.color
  if (body.type !== undefined) fields.type = body.type
  if (body.probability !== undefined) fields.probability = body.probability

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('pipeline_stages')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data: stage, error: stageError } = await supabase
    .from('pipeline_stages')
    .select('slug')
    .eq('id', id)
    .single()

  if (stageError || !stage) {
    return NextResponse.json({ error: 'Estágio não encontrado.' }, { status: 404 })
  }

  // Não permitir excluir se for o último estágio do pipeline
  const { count: totalStages } = await supabase
    .from('pipeline_stages')
    .select('*', { count: 'exact', head: true })

  if ((totalStages ?? 0) <= 1) {
    return NextResponse.json(
      { error: 'O pipeline precisa ter ao menos uma coluna.' },
      { status: 409 }
    )
  }

  // Bloquear se existirem leads neste estágio
  const { count: leadsCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('stage', stage.slug)

  if ((leadsCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Mova os leads desta coluna antes de excluir.' },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('pipeline_stages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
