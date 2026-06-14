import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/validation'
import { expenseCreateSchema } from '@/lib/api/schemas'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const recurring = searchParams.get('recurring')
  const month = searchParams.get('month')

  let query = supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })

  if (recurring === 'true') query = query.eq('recurring', true)
  else if (recurring === 'false') query = query.eq('recurring', false)

  if (month) {
    query = query.gte('date', `${month}-01`).lte('date', `${month}-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const parsed = await parseBody(request, expenseCreateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      description: body.description,
      amount: body.amount,
      category: body.category ?? null,
      date: body.date,
      recurring: body.recurring ?? false,
      recurring_day: body.recurring_day ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
