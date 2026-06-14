import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { rateLimit } from '@/lib/api/rate-limit'
import { transactionImportSchema } from '@/lib/api/schemas'

export async function POST(request: Request) {
  const limited = rateLimit(request, 'transactions-import', { limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const supabase = await createClient()
  const parsed = await parseBody(request, transactionImportSchema)
  if (!parsed.ok) return parsed.response
  const { rows } = parsed.data

  const { error, count } = await supabase
    .from('transactions')
    .insert(
      rows.map((row) => ({
        client_id: row.client_id,
        amount: row.amount,
        type: row.type,
        date: row.date,
        description: row.description ?? null,
      })),
      { count: 'exact' }
    )

  if (error) {
    return NextResponse.json({ inserted: 0, failed: rows.length, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: count ?? rows.length, failed: 0 }, { status: 201 })
}
