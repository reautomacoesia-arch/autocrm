import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileEditor from './ProfileEditor'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Create profile if it doesn't exist yet
  if (!profile) {
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuário',
      })
      .select()
      .single()

    return <ProfileEditor profile={created} userId={user.id} />
  }

  return <ProfileEditor profile={profile} userId={user.id} />
}
