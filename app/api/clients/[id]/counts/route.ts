import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { count: projects },
    { count: proposals },
    { count: transactions },
    { count: interactions },
    { count: tasks_total },
    { count: tasks_pending },
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('interactions').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('client_id', id).neq('status', 'done'),
  ])

  return NextResponse.json({
    projects: projects ?? 0,
    proposals: proposals ?? 0,
    transactions: transactions ?? 0,
    interactions: interactions ?? 0,
    tasks_total: tasks_total ?? 0,
    tasks_pending: tasks_pending ?? 0,
  })
}
