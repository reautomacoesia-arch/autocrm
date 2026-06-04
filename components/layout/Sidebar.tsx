'use client'

import Link from 'next/link'
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
    <aside className="w-52 min-h-screen bg-[#1e293b] flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-white font-bold text-sm">AutoCRM</span>
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
