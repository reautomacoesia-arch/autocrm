import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { projectUpdateSchema } from '@/lib/api/schemas'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const supabase = await createClient()
  const { projectId } = await params
  const parsed = await parseBody(request, projectUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('projects')
    .update({
      name: body.name,
      description: body.description ?? null,
      status: body.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const supabase = await createClient()
  const { projectId } = await params

  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
