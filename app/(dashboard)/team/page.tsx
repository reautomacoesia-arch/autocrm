import { createClient } from '@/lib/supabase/server'
import TeamClient from './TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true })

  // Se o usuário logado não tem perfil ainda, cria um
  if (user && profiles && !profiles.find((p) => p.id === user.id)) {
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuário',
    })
    // Recarrega
    const { data: fresh } = await supabase.from('profiles').select('*').order('name')
    return <TeamClient profiles={fresh ?? []} currentUserId={user?.id ?? ''} />
  }

  return <TeamClient profiles={profiles ?? []} currentUserId={user?.id ?? ''} />
}
