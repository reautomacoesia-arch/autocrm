import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, ExternalLink, PenLine, TrendingUp, Plus } from 'lucide-react'
import type { Proposal } from '@/lib/types'
import ProposalList from '@/components/ProposalList'
import AnalyticsFunnel from '@/components/AnalyticsFunnel'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const list = (proposals || []) as Proposal[]

  const stats = {
    total: list.length,
    sent: list.filter((p) => p.status !== 'draft').length,
    signed: list.filter((p) => p.status === 'signed' || p.status === 'paid').length,
    revenue: list.filter((p) => p.status === 'paid').reduce((s, p) => s + p.proposal_value, 0),
  }

  const statsCards = [
    { label: 'Propostas', value: stats.total,                   icon: FileText    },
    { label: 'Enviadas',  value: stats.sent,                    icon: ExternalLink },
    { label: 'Assinadas', value: stats.signed,                  icon: PenLine     },
    { label: 'Receita',   value: formatCurrency(stats.revenue), icon: TrendingUp  },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-10 gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-black text-white uppercase tracking-tight mb-1" style={{ fontSize: '2.25rem', letterSpacing: '-0.02em' }}>
            Propostas
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
            Gerencie e acompanhe seu pipeline comercial
          </p>
        </div>
        <Link
          href="/proposals/new"
          className="flex items-center gap-2 font-heading font-black uppercase text-sm rounded-xl px-5 py-3 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
          style={{
            background: '#D4AF37',
            color: '#050505',
            letterSpacing: '0.06em',
          }}
        >
          <Plus size={16} />
          Nova Proposta
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statsCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-5" style={{
            background: '#1A1A1D',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{
              background: 'rgba(212,175,55,0.1)',
              border: '1px solid rgba(212,175,55,0.2)',
            }}>
              <Icon size={15} style={{ color: '#D4AF37' }} />
            </div>
            <div className="font-mono text-2xl font-normal text-white mb-0.5">{value}</div>
            <div className="font-heading font-bold uppercase text-xs" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <AnalyticsFunnel proposals={list} />

      <ProposalList proposals={list} appUrl={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'} />
    </div>
  )
}
