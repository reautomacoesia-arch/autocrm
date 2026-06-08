'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Users,
  FileText,
  DollarSign,
  CheckSquare,
  Settings,
  Zap,
} from 'lucide-react'
import NotificationBell from '@/components/automations/NotificationBell'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/pipeline', icon: Target, label: 'Pipeline' },
  { href: '/clients', icon: Users, label: 'Clientes' },
  { href: '/proposals', icon: FileText, label: 'Propostas' },
  { href: '/financial', icon: DollarSign, label: 'Financeiro' },
  { href: '/tasks', icon: CheckSquare, label: 'Tarefas' },
  { href: '/automations', icon: Zap, label: 'Automações' },
  { href: '/services', icon: Settings, label: 'Serviços' },
]

export default function Sidebar() {
  const pathname = usePathname()

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

      {/* Navegação */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Notifications */}
      <div className="px-3 py-3 border-t border-slate-700">
        <NotificationBell />
      </div>
    </aside>
  )
}
