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

  // Busca o documento atual
  const { data: doc } = await supabase
    .from('workspace_docs')
    .select('*')
    .eq('id', id)
    .single()

  if (!doc) redirect('/docs')

  // Define o caderno: se for página, busca o pai; se for caderno, é ele mesmo
  const notebookId = doc.parent_id ?? doc.id

  const notebookData = doc.parent_id
    ? await supabase.from('workspace_docs').select('id, title, visibility, created_by').eq('id', doc.parent_id).single()
    : null
  const notebook = notebookData?.data ?? { id: doc.id, title: doc.title, visibility: doc.visibility, created_by: doc.created_by }

  // Busca páginas do caderno
  const { data: pages } = await supabase
    .from('workspace_docs')
    .select('id, title, created_at')
    .eq('parent_id', notebookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <DocEditorPage
      doc={doc}
      notebook={notebook}
      pages={pages ?? []}
      currentUserId={user.id}
    />
  )
}
