import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { taskChecklistCreateSchema } from '@/lib/api/schemas'
import type { TaskChecklistItem, TaskChecklistWithItems } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data: checklists, error } = await supabase
    .from('task_checklists')
    .select('*')
    .eq('task_id', id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: items, error: itemsError } = await supabase
    .from('task_checklist_items')
    .select('*')
    .eq('task_id', id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  const result: TaskChecklistWithItems[] = (checklists ?? []).map((c) => ({
    ...c,
    items: (items ?? []).filter((i: TaskChecklistItem) => i.checklist_id === c.id),
  }))

  return NextResponse.json(result)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, taskChecklistCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data: existing } = await supabase
    .from('task_checklists')
    .select('position')
    .eq('task_id', id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? (existing[0].position ?? 0) + 1 : 0

  const { data, error } = await supabase
    .from('task_checklists')
    .insert({ task_id: id, title: body.title ?? 'Checklist', position: nextPosition })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result: TaskChecklistWithItems = { ...data, items: [] }
  return NextResponse.json(result, { status: 201 })
}
