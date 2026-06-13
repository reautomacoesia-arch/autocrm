import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Inbox, Target, Users, FileText, DollarSign, BarChart2, CheckSquare, BookOpen, Users2, Zap, Settings } from 'lucide-react'

export type NavGroup = 'Operação' | 'Gestão' | 'Workspace'
export interface NavItem { href: string; label: string; icon: LucideIcon; group: NavGroup | null; shortcut: string }

export const NAV_ITEMS: NavItem[] = [
  { href: '/',            label: 'Dashboard',   icon: LayoutDashboard, group: null,        shortcut: 'd' },
  { href: '/inbox',       label: 'Inbox',       icon: Inbox,           group: 'Operação',  shortcut: 'i' },
  { href: '/pipeline',    label: 'Pipeline',    icon: Target,          group: 'Operação',  shortcut: 'p' },
  { href: '/clients',     label: 'Clientes',    icon: Users,           group: 'Operação',  shortcut: 'c' },
  { href: '/proposals',   label: 'Propostas',   icon: FileText,        group: 'Operação',  shortcut: 'l' },
  { href: '/financial',   label: 'Financeiro',  icon: DollarSign,      group: 'Gestão',    shortcut: 'f' },
  { href: '/reports',     label: 'Relatórios',  icon: BarChart2,       group: 'Gestão',    shortcut: 'r' },
  { href: '/tasks',       label: 'Tarefas',     icon: CheckSquare,     group: 'Gestão',    shortcut: 't' },
  { href: '/docs',        label: 'Documentos',  icon: BookOpen,        group: 'Workspace', shortcut: 'o' },
  { href: '/team',        label: 'Equipe',      icon: Users2,          group: 'Workspace', shortcut: 'e' },
  { href: '/automations', label: 'Automações',  icon: Zap,             group: 'Workspace', shortcut: 'a' },
  { href: '/services',    label: 'Serviços',    icon: Settings,        group: 'Workspace', shortcut: 's' },
]
export const NAV_GROUPS: NavGroup[] = ['Operação', 'Gestão', 'Workspace']
