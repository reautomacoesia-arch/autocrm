import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { workflowCreateSchema } from '@/lib/api/schemas'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('automation_workflows')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const parsed = await parseBody(request, workflowCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('automation_workflows')
    .insert({
      name: body.name,
      trigger_type: body.trigger_type,
      enabled: body.enabled ?? true,
      conditions: body.conditions ?? [],
      actions: body.actions,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
