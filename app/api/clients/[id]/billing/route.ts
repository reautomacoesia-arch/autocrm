import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { billingSchema } from '@/lib/api/schemas'

/**
 * PATCH /api/clients/[id]/billing
 * Body: { billing_day: number | null }
 *
 * Sets or clears the monthly auto-billing day for a client.
 * billing_day = 5  → cron generates a "pending" transaction on the 5th of each month
 * billing_day = null → disables auto-billing
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { id } = await params
  const parsed = await parseBody(request, billingSchema)
  if (!parsed.ok) return parsed.response
  const billingDay: number | null = parsed.data.billing_day ?? null

  const { error } = await supabase
    .from('clients')
    .update({ billing_day: billingDay, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, billing_day: billingDay })
}
