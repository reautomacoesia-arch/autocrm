import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { rateLimit } from '@/lib/api/rate-limit'
import { expenseImportSchema } from '@/lib/api/schemas'

export async function POST(request: Request) {
  const limited = rateLimit(request, 'expenses-import', { limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const supabase = await createClient()
  const parsed = await parseBody(request, expenseImportSchema)
  if (!parsed.ok) return parsed.response
  const { rows } = parsed.data

  const { error, count } = await supabase
    .from('expenses')
    .insert(
      rows.map((row) => ({
        description: row.description,
        amount: row.amount,
        category: row.category ?? null,
        date: row.date,
        recurring: false,
        client_id: row.client_id ?? null,
      })),
      { count: 'exact' }
    )

  if (error) {
    return NextResponse.json({ inserted: 0, failed: rows.length, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: count ?? rows.length, failed: 0 }, { status: 201 })
}
