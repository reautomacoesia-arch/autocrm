import { createClient } from '@/lib/supabase/server'
import ServiceList from '@/components/services/ServiceList'
import type { Service } from '@/lib/types'

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('name')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Catálogo de Serviços</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gerencie os serviços que você oferece — usados para criar propostas rapidamente.
        </p>
      </div>
      <ServiceList initialServices={(services as Service[]) ?? []} />
    </div>
  )
}
