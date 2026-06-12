import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/api/rate-limit'
import { NextResponse } from 'next/server'

export interface SearchResultItem {
  type: 'lead' | 'client' | 'proposal' | 'doc' | 'conversation'
  id: string
  title: string
  subtitle: string | null
  href: string
}

export async function GET(request: Request) {
  const limited = rateLimit(request, 'search', { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  // remove caracteres com significado especial no filtro .or()/ilike do PostgREST
  const sanitized = q.replace(/[,()%*]/g, '')
  if (sanitized.length < 2) return NextResponse.json([])

  const term = `%${sanitized}%`

  const [leads, clients, proposals, docs, conversations] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, company')
      .or(`name.ilike.${term},company.ilike.${term}`)
      .limit(5),
    supabase
      .from('clients')
      .select('id, name, company')
      .or(`name.ilike.${term},company.ilike.${term}`)
      .limit(5),
    supabase
      .from('proposals')
      .select('id, value, status, notes')
      .ilike('notes', term)
      .limit(5),
    supabase
      .from('workspace_docs')
      .select('id, title')
      .ilike('title', term)
      .limit(5),
    supabase
      .from('inbox_conversations')
      .select('id, contact_name, contact_handle, channel')
      .or(`contact_name.ilike.${term},contact_handle.ilike.${term}`)
      .limit(5),
  ])

  const results: SearchResultItem[] = [
    ...(leads.data ?? []).map((l) => ({
      type: 'lead' as const,
      id: l.id,
      title: l.name,
      subtitle: l.company,
      href: '/pipeline',
    })),
    ...(clients.data ?? []).map((c) => ({
      type: 'client' as const,
      id: c.id,
      title: c.name,
      subtitle: c.company,
      href: `/clients/${c.id}`,
    })),
    ...(proposals.data ?? []).map((p) => ({
      type: 'proposal' as const,
      id: p.id,
      title: `Proposta — ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value)}`,
      subtitle: p.notes,
      href: `/proposals/${p.id}`,
    })),
    ...(docs.data ?? []).map((d) => ({
      type: 'doc' as const,
      id: d.id,
      title: d.title,
      subtitle: null,
      href: `/docs/${d.id}`,
    })),
    ...(conversations.data ?? []).map((c) => ({
      type: 'conversation' as const,
      id: c.id,
      title: c.contact_name,
      subtitle: c.contact_handle,
      href: `/inbox?conversation=${c.id}`,
    })),
  ]

  return NextResponse.json(results)
}
