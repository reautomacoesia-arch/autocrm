import { createClient } from '@/lib/supabase/server'
import ClientList from '@/components/clients/ClientList'
import PageHeader from '@/components/ui/PageHeader'
import type { Client } from '@/lib/types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  const activeCount = (clients ?? []).filter((c) => c.status === 'active').length

  const { data: lastInteractionsRaw } = await supabase
    .from('interactions')
    .select('client_id, happened_at')
    .order('happened_at', { ascending: false })

  const lastInteractionMap: Record<string, string> = {}
  for (const row of (lastInteractionsRaw ?? [])) {
    if (!lastInteractionMap[row.client_id]) {
      lastInteractionMap[row.client_id] = row.happened_at
    }
  }

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${activeCount} ativo(s)`} />
      <ClientList clients={(clients as Client[]) ?? []} lastInteractions={lastInteractionMap} />
    </div>
  )
}
