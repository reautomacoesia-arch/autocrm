import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InboxClient from '@/components/inbox/InboxClient'
import type { Client, InboxConversation, Lead, Profile } from '@/lib/types'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>
}) {
  const { conversation } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [conversationsRes, profilesRes, clientsRes, leadsRes] = await Promise.all([
    supabase
      .from('inbox_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('name'),
    supabase
      .from('clients')
      .select('id, name, company, phone, instagram')
      .eq('status', 'active')
      .order('name'),
    supabase.from('leads').select('id, name, company, phone, instagram').order('name'),
  ])

  return (
    <div className="h-[calc(100vh-4rem)] -m-8">
      <InboxClient
        initialConversations={(conversationsRes.data as InboxConversation[]) ?? []}
        profiles={(profilesRes.data as Profile[]) ?? []}
        initialClients={(clientsRes.data as Client[]) ?? []}
        initialLeads={(leadsRes.data as Lead[]) ?? []}
        currentUserId={user.id}
        initialSelectedId={conversation ?? null}
      />
    </div>
  )
}
