'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import NotificationBell from '@/components/automations/NotificationBell'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => { if (data) setProfile(data) })
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="sticky top-0 z-30 flex items-center justify-end gap-2 px-8 h-14 bg-[#050505]/80 backdrop-blur border-b border-slate-800">
      <NotificationBell />

      <Link
        href="/profile"
        title="Meu perfil"
        className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full transition-colors hover:bg-slate-700/50 ${
          pathname === '/profile' ? 'bg-indigo-600/10' : ''
        }`}
      >
        {profile ? (
          <ProfileAvatar
            name={profile.name || '?'}
            color={profile.avatar_color}
            avatarUrl={profile.avatar_url}
            size="sm"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-slate-700 flex-shrink-0" />
        )}
        <span className="text-slate-300 text-sm font-medium truncate max-w-[160px]">
          {profile?.name || '...'}
        </span>
      </Link>

      <button
        onClick={handleLogout}
        title="Sair da conta"
        className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-md hover:bg-slate-700/50"
      >
        <LogOut size={16} />
      </button>
    </div>
  )
}
