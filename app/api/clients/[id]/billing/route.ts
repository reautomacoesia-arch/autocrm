import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  const body = await request.json()
  const billingDay: number | null = body.billing_day ?? null

  if (billingDay !== null && (billingDay < 1 || billingDay > 28 || !Number.isInteger(billingDay))) {
    return NextResponse.json(
      { error: 'billing_day deve ser um inteiro entre 1 e 28' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('clients')
    .update({ billing_day: billingDay, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, billing_day: billingDay })
}
