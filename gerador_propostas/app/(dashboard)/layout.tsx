import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, Settings } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: '#050505' }}>
      <header className="relative sticky top-0 z-50 px-6 py-4" style={{
        background: 'rgba(5,5,5,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212,175,55,0.12)',
      }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
              style={{ background: '#D4AF37' }}
            >
              <span className="font-heading font-black text-sm" style={{ color: '#050505' }}>K</span>
            </div>
            <div>
              <span className="font-heading font-black text-sm tracking-widest text-white uppercase block">
                KORVUS AI
              </span>
              <span className="font-heading font-bold uppercase block" style={{
                color: '#D4AF37', fontSize: '9px', letterSpacing: '0.2em',
              }}>
                CRM · AUTOMAÇÃO
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/financeiro"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <BarChart3 size={12} />
              <span className="hidden sm:inline">Financeiro</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Settings size={12} />
              <span className="hidden sm:inline">Configurações</span>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}
