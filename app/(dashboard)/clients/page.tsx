import { createClient } from '@/lib/supabase/server'
import ClientList from '@/components/clients/ClientList'
import type { Client } from '@/lib/types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  const activeCount = (clients ?? []).filter((c) => c.status === 'active').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Clientes</h1>
          <p className="text-slate-400 text-sm mt-1">{activeCount} ativo(s)</p>
        </div>
      </div>
      <ClientList clients={(clients as Client[]) ?? []} />
    </div>
  )
}
