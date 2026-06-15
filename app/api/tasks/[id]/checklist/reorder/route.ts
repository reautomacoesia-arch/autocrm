import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { checklistItemReorderSchema } from '@/lib/api/schemas'

export async function POST(request: Request) {
  const supabase = await createClient()
  const parsed = await parseBody(request, checklistItemReorderSchema)
  if (!parsed.ok) return parsed.response
  const { checklist_id, ids } = parsed.data

  // Atualiza a posição de cada item conforme a ordem recebida
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase.from('task_checklist_items').update({ position: index }).eq('id', id).eq('checklist_id', checklist_id)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
