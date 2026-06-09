import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DocEditorPage from '@/components/docs/DocEditorPage'

export default async function DocPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: doc } = await supabase
    .from('workspace_docs')
    .select('*')
    .eq('id', id)
    .single()

  if (!doc) redirect('/docs')

  return <DocEditorPage doc={doc} currentUserId={user.id} />
}
