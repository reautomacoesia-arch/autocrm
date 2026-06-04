import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('automation_configs')
    .update({
      enabled: body.enabled,
      config: body.config ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('automation_key', key)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
