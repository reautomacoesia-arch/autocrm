import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTOMATION_DEFINITIONS, AUTOMATION_DEFAULTS } from '@/lib/automations'

export async function GET() {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('automation_configs')
    .select('*')

  const existingKeys = new Set((existing ?? []).map((c: any) => c.automation_key))

  const toInsert = AUTOMATION_DEFINITIONS
    .filter((def) => !existingKeys.has(def.key))
    .map((def) => ({
      automation_key: def.key,
      enabled: false,
      config: AUTOMATION_DEFAULTS[def.key] ?? null,
    }))

  if (toInsert.length > 0) {
    await supabase.from('automation_configs').insert(toInsert)
  }

  const { data, error } = await supabase
    .from('automation_configs')
    .select('*')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
