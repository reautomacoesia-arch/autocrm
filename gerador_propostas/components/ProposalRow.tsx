'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, Clock, PenLine, FileSignature, Building2, Mail, Eye, AlertTriangle, Send, Copy as CopyIcon, Loader2, Check, MessageCircle, Activity } from 'lucide-react'
import CopyButton from './CopyButton'
import DeleteButton from './DeleteButton'
import FollowupButton from './FollowupButton'
import { Badge } from '@/components/ui/badge'
import type { Proposal } from '@/lib/types'

const statusConfig = {
  draft:  { label: 'Rascunho', color: 'rgba(148,163,184,0.8)', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
  sent:   { label: 'Enviada',  color: 'rgba(148,163,184,0.9)', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
  signed: { label: 'Assinada', color: 'rgba(251,191,36,0.9)',  bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)' },
  paid:   { label: 'Paga',     color: 'rgba(52,211,153,0.9)',  bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
  expired:{ label: 'Expirada', color: 'rgba(248,113,113,0.9)', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProposalRow({ proposal, publicUrl }: { proposal: Proposal; publicUrl: string }) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const cfg = statusConfig[proposal.status]
  const formData = (proposal as any).form_data || {}

  async function handleSendEmail() {
    setSending(true)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/send-email`, { method: 'POST' })
      if (res.ok) {
        setSent(true)
        setTimeout(() => setSent(false), 2500)
        router.refresh()
      }
    } finally {
      setSending(false)
    }
  }

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/duplicate`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) router.push(`/proposals/${data.id}/edit`)
    } finally {
      setDuplicating(false)
    }
  }

  // Monta o link wa.me com a proposta pré-preenchida (custo zero)
  function whatsappLink(): string | null {
    const raw = (formData.client_phone || '').replace(/\D/g, '')
    if (!raw) return null
    const phone = raw.startsWith('55') ? raw : `55${raw}`
    const msg = `Olá ${proposal.client_name}! Segue a sua proposta: ${publicUrl}`
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  }
  const waLink = whatsappLink()
  const views = (proposal as any).view_count ?? 0
  const expiresAt = (proposal as any).expires_at
  const isExpiringSoon =
    expiresAt &&
    proposal.status !== 'paid' &&
    new Date(expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 &&
    new Date(expiresAt).getTime() > Date.now()
  const isExpired =
    expiresAt && proposal.status !== 'paid' && new Date(expiresAt).getTime() < Date.now()

  return (
    <div className="proposal-row rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />

      <div className="flex-1 min-w-0">
        {/* Linha 1: nome + status */}
        <div className="flex items-center gap-2.5 mb-1">
          <span className="text-white font-semibold text-sm truncate">{proposal.client_name}</span>
          <Badge
            variant="outline"
            className="shrink-0 text-xs font-medium"
            style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}
          >
            {cfg.label}
          </Badge>
        </div>

        {/* Linha 2: empresa + email */}
        <div className="flex items-center gap-4 mb-1.5">
          {formData.client_company && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Building2 size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />
              {formData.client_company}
            </span>
          )}
          {proposal.client_email && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Mail size={10} />
              {proposal.client_email}
            </span>
          )}
        </div>

        {/* Linha 3: valor + data + visualizações + validade */}
        <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {formatCurrency(proposal.proposal_value)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatDate(proposal.created_at)}
          </span>
          {views > 0 && (
            <span className="flex items-center gap-1" title={`${views} visualizações`}>
              <Eye size={10} />
              {views}
            </span>
          )}
          {isExpired && (
            <span className="flex items-center gap-1" style={{ color: 'rgba(248,113,113,0.8)' }}>
              <AlertTriangle size={10} />
              Expirada
            </span>
          )}
          {isExpiringSoon && (
            <span className="flex items-center gap-1" style={{ color: 'rgba(251,191,36,0.8)' }}>
              <AlertTriangle size={10} />
              Expira em breve
            </span>
          )}
        </div>
      </div>

      <div className="row-actions flex items-center gap-1 shrink-0">
        {waLink && (
          <a href={waLink} target="_blank" title="Enviar via WhatsApp" className="action-btn p-2" style={{ color: 'rgba(37,211,102,0.7)' }}>
            <MessageCircle size={14} />
          </a>
        )}
        <button
          onClick={handleSendEmail}
          disabled={sending}
          title="Enviar por email ao cliente"
          className="action-btn p-2 disabled:opacity-50"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : sent ? <Check size={14} className="text-green-400" /> : <Send size={14} />}
        </button>
        <CopyButton url={publicUrl} />
        <Link href={`/p/${proposal.token}`} target="_blank" title="Abrir proposta" className="action-btn p-2">
          <ExternalLink size={14} />
        </Link>
        <Link href={`/proposals/${proposal.id}/edit`} title="Editar" className="action-btn p-2">
          <PenLine size={14} />
        </Link>
        <Link href={`/proposals/${proposal.id}/activity`} title="Atividade" className="action-btn p-2">
          <Activity size={14} />
        </Link>
        <button
          onClick={handleDuplicate}
          disabled={duplicating}
          title="Duplicar proposta"
          className="action-btn p-2 disabled:opacity-50"
        >
          {duplicating ? <Loader2 size={14} className="animate-spin" /> : <CopyIcon size={14} />}
        </button>
        {(proposal.status === 'sent' || proposal.status === 'signed') && (
          <FollowupButton proposalId={proposal.id} clientName={proposal.client_name} clientPhone={formData.client_phone} />
        )}
        {(proposal.status === 'signed' || proposal.status === 'paid') && (
          <Link href={`/proposals/${proposal.id}/contract`} title="Ver contrato" className="action-btn green p-2">
            <FileSignature size={14} />
          </Link>
        )}
        <DeleteButton proposalId={proposal.id} />
      </div>
    </div>
  )
}
