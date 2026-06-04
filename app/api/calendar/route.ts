import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
  }

  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const supabase = await createClient()

  const [tasksRes, transactionsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, due_date, status, client_id')
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .neq('status', 'done'),
    supabase
      .from('transactions')
      .select('id, amount, date, type, client_id, clients(name)')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('type', 'pending'),
  ])

  return NextResponse.json({
    tasks: tasksRes.data ?? [],
    transactions: transactionsRes.data ?? [],
  })
}
