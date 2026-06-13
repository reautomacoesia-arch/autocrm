import { createClient } from '@/lib/supabase/server'
import ServiceList from '@/components/services/ServiceList'
import PageHeader from '@/components/ui/PageHeader'
import type { Service } from '@/lib/types'

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('name')

  return (
    <div>
      <PageHeader
        title="Catálogo de Serviços"
        subtitle="Gerencie os serviços que você oferece — usados para criar propostas rapidamente."
      />
      <ServiceList initialServices={(services as Service[]) ?? []} />
    </div>
  )
}
