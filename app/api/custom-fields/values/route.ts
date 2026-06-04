import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { FieldWithValue } from '@/lib/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const entity_type = searchParams.get('entity_type')
  const entity_id = searchParams.get('entity_id')

  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: defs, error: defsError } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('entity_type', entity_type)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (defsError) return NextResponse.json({ error: defsError.message }, { status: 500 })
  if (!defs || defs.length === 0) return NextResponse.json([])

  const { data: values, error: valuesError } = await supabase
    .from('custom_field_values')
    .select('*')
    .eq('entity_id', entity_id)
    .in('definition_id', defs.map((d) => d.id))

  if (valuesError) return NextResponse.json({ error: valuesError.message }, { status: 500 })

  const result: FieldWithValue[] = defs.map((def) => ({
    definition: def,
    value: values?.find((v) => v.definition_id === def.id)?.value ?? null,
  }))

  return NextResponse.json(result)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { entity_id, values } = body

  if (!entity_id || !Array.isArray(values)) {
    return NextResponse.json({ error: 'entity_id and values required' }, { status: 400 })
  }

  for (const item of values) {
    if (item.value === null || item.value === '') {
      await supabase
        .from('custom_field_values')
        .delete()
        .eq('definition_id', item.definition_id)
        .eq('entity_id', entity_id)
    } else {
      await supabase.from('custom_field_values').upsert(
        {
          definition_id: item.definition_id,
          entity_id,
          value: item.value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'definition_id,entity_id' }
      )
    }
  }

  return NextResponse.json({ success: true })
}
