import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; interactionId: string }> }
) {
  const supabase = await createClient()
  const { interactionId } = await params

  const { error } = await supabase
    .from('interactions')
    .delete()
    .eq('id', interactionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
