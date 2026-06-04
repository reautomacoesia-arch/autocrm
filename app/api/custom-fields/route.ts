import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const entity_type = searchParams.get('entity_type')
  if (!entity_type) {
    return NextResponse.json({ error: 'entity_type required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('entity_type', entity_type)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { count } = await supabase
    .from('custom_field_definitions')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', body.entity_type)

  const { data, error } = await supabase
    .from('custom_field_definitions')
    .insert({
      entity_type: body.entity_type,
      name: body.name,
      field_type: body.field_type,
      options: body.options ?? null,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
