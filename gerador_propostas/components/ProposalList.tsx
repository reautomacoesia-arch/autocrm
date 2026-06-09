'use client'

import { useState, useMemo } from 'react'
import { Search, X, FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import ProposalRow from './ProposalRow'
import type { Proposal } from '@/lib/types'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent', label: 'Enviada' },
  { value: 'signed', label: 'Assinada' },
  { value: 'paid', label: 'Paga' },
  { value: 'expired', label: 'Expirada' },
]

export default function ProposalList({ proposals, appUrl }: { proposals: Proposal[]; appUrl: string }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return proposals.filter((p) => {
      const formData = (p as any).form_data || {}
      const matchesSearch = !q || (
        p.client_name.toLowerCase().includes(q) ||
        (formData.client_company || '').toLowerCase().includes(q) ||
        (p.client_email || '').toLowerCase().includes(q)
      )
      const matchesStatus = !status || p.status === status
      return matchesSearch && matchesStatus
    })
  }, [proposals, search, status])

  return (
    <div>
      {/* Barra de filtros */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'rgba(255,255,255,0.25)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou empresa..."
            className="w-full text-sm pl-9 pr-9 py-2.5 rounded-xl outline-none transition-all"
            style={{
              background: '#1A1A1D',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.9)',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'rgba(212,175,55,0.5)'}
            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className="font-heading font-bold uppercase text-xs px-3 py-2 rounded-xl transition-all duration-150"
              style={{
                letterSpacing: '0.08em',
                background: status === opt.value ? 'rgba(212,175,55,0.12)' : '#1A1A1D',
                border: status === opt.value ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.08)',
                color: status === opt.value ? '#D4AF37' : 'rgba(255,255,255,0.4)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Contador */}
        {(search || status) && (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl py-16 text-center" style={{
          background: '#1A1A1D',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {search || status ? (
            <>
              <p className="text-white font-bold mb-1">Nenhum resultado</p>
              <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Tente outros termos ou limpe os filtros
              </p>
              <button
                onClick={() => { setSearch(''); setStatus('') }}
                className="font-heading font-bold uppercase text-sm px-4 py-2 rounded-xl transition-all"
                style={{
                  color: '#D4AF37',
                  background: 'rgba(212,175,55,0.1)',
                  border: '1px solid rgba(212,175,55,0.25)',
                  letterSpacing: '0.08em',
                }}
              >
                Limpar filtros
              </button>
            </>
          ) : (
            <>
              <FileText size={36} className="mx-auto mb-3" style={{ color: 'rgba(212,175,55,0.3)' }} />
              <p className="text-white font-bold mb-1">Nenhuma proposta ainda</p>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Crie sua primeira proposta com IA em menos de 2 minutos
              </p>
              <Link
                href="/proposals/new"
                className="inline-flex items-center gap-2 font-heading font-black uppercase text-sm rounded-xl px-6 py-3"
                style={{ background: '#D4AF37', color: '#050505', letterSpacing: '0.06em' }}
              >
                <Plus size={15} /> Criar primeira proposta
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(proposal => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              publicUrl={`${appUrl}/p/${proposal.token}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
