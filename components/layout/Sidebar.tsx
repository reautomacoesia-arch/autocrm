'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Inbox,
  Target,
  Users,
  Users2,
  FileText,
  DollarSign,
  CheckSquare,
  Settings,
  Zap,
  LogOut,
  BarChart2,
  BookOpen,
  Search,
  type LucideIcon,
} from 'lucide-react'
import NotificationBell from '@/components/automations/NotificationBell'
import ProfileAvatar from '@/components/team/ProfileAvatar'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const topItem = { href: '/', icon: LayoutDashboard, label: 'Dashboard' }

const navGroups = [
  {
    label: 'Operação',
    items: [
      { href: '/inbox', icon: Inbox, label: 'Inbox' },
      { href: '/pipeline', icon: Target, label: 'Pipeline' },
      { href: '/clients', icon: Users, label: 'Clientes' },
      { href: '/proposals', icon: FileText, label: 'Propostas' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/financial', icon: DollarSign, label: 'Financeiro' },
      { href: '/reports', icon: BarChart2, label: 'Relatórios' },
      { href: '/tasks', icon: CheckSquare, label: 'Tarefas' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/docs', icon: BookOpen, label: 'Documentos' },
      { href: '/team', icon: Users2, label: 'Equipe' },
      { href: '/automations', icon: Zap, label: 'Automações' },
      { href: '/services', icon: Settings, label: 'Serviços' },
    ],
  },
]

interface NavLinkProps {
  href: string
  icon: LucideIcon
  label: string
  isActive: boolean
}

function NavLink({ href, icon: Icon, label, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
        isActive
          ? 'bg-indigo-600/20 text-indigo-400 font-medium'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#d4af37] rounded-r" />
      )}
      <Icon size={15} />
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
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
    <aside className="w-52 min-h-screen bg-[#1a1a1d] flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md overflow-hidden bg-black flex-shrink-0">
            <Image
              src="/korvus-icon.png"
              alt="Korvus"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="leading-none">
            <span className="block text-white font-display font-extrabold text-sm tracking-wider uppercase">
              Korvus
            </span>
            <span className="block text-[#d4af37] text-[10px] font-medium tracking-[0.2em] uppercase mt-0.5">
              CRM
            </span>
          </div>
        </div>
      </div>

      {/* Busca global */}
      <div className="px-2 pt-3">
        <button
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors border border-slate-700"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {/* Dashboard (solto no topo) */}
        <NavLink
          href={topItem.href}
          icon={topItem.icon}
          label={topItem.label}
          isActive={pathname === '/'}
        />

        {/* Grupos */}
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-slate-600 text-[10px] uppercase tracking-wider px-3 mb-1 mt-4">
              {group.label}
            </p>
            {group.items.map(({ href, icon: Icon, label }) => (
              <NavLink
                key={href}
                href={href}
                icon={Icon}
                label={label}
                isActive={pathname.startsWith(href)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* User profile + actions */}
      <div className="border-t border-slate-700">
        {/* Profile link */}
        <Link
          href="/profile"
          className={`flex items-center gap-2.5 px-3 py-3 transition-colors hover:bg-slate-700/50 ${
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
          <div className="flex-1 min-w-0">
            <p className="text-slate-300 text-xs font-medium truncate">
              {profile?.name || '...'}
            </p>
            <p className="text-slate-600 text-[10px] truncate">Meu perfil</p>
          </div>
        </Link>

        {/* Notifications + Logout */}
        <div className="px-3 py-2 flex items-center justify-between border-t border-slate-800">
          <NotificationBell />
          <button
            onClick={handleLogout}
            title="Sair da conta"
            className="text-slate-500 hover:text-red-400 transition-colors p-1.5"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
