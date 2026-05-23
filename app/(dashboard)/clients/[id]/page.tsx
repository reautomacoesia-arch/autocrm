import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientFolder from '@/components/clients/folder/ClientFolder'
import type { Client } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ClientPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab = 'onboarding' } = await searchParams

  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) notFound()

  return <ClientFolder client={client as Client} activeTab={tab} />
}
