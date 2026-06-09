'use client'

import { useState } from 'react'
import SignatureCanvas from './SignatureCanvas'
import ConfettiEffect from './ConfettiEffect'
import ProposalTemplate, { type GeneratedContent } from './ProposalTemplate'
import type { Proposal, Addon } from '@/lib/types'
import type { AgencySettings } from '@/lib/settings'
import { computeTotals, formatBRL } from '@/lib/pricing'
import { Calendar, Check, RefreshCw } from 'lucide-react'

type Step = 'proposal' | 'pricing' | 'signature' | 'payment' | 'success'

export default function PublicProposalClient({
  proposal,
  forceSuccess = false,
  isExpired = false,
  settings,
}: {
  proposal: Proposal
  forceSuccess?: boolean
  isExpired?: boolean
  settings: AgencySettings
}) {
  const [step, setStep] = useState<Step>(
    forceSuccess || proposal.status === 'paid' ? 'success' :
    proposal.status === 'signed' ? 'payment' :
    'proposal'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(proposal.asaas_payment_link)
  const [accepted, setAccepted] = useState(false)

  const content = (proposal as any).generated_content as GeneratedContent
  const addons: Addon[] = ((proposal as any).addons as Addon[]) || []
  const baseMonthly: number = (proposal as any).monthly_value || 0
  const hasPricingStep = addons.length > 0 || baseMonthly > 0

  // IDs dos add-ons selecionados pelo cliente
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const totals = computeTotals(proposal.proposal_value, baseMonthly, addons, selectedAddons)

  const value = formatBRL(totals.setup)

  function toggleAddon(id: string) {
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function startAccept() {
    if (hasPricingStep) setStep('pricing')
    else setStep('signature')
  }

  // Proposta expirada — bloqueia tudo exceto leitura
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center"
        style={{ background: '#050505' }}>
        <div className="max-w-md rounded-3xl p-10" style={{
          background: '#1A1A1D',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div className="text-5xl mb-5">⌛</div>
          <h1 className="text-2xl font-black text-white mb-3">Proposta expirada</h1>
          <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            O prazo de validade desta proposta foi encerrado.
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Entre em contato com quem enviou para receber uma proposta atualizada.
          </p>
        </div>
      </div>
    )
  }

  async function handleSign(signatureData: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_data: signatureData,
          selected_addons: selectedAddons,
          final_setup_value: totals.setup,
          final_monthly_value: totals.monthly,
        }),
      })
      if (!res.ok) throw new Error('Falha ao registrar assinatura')
      setStep('payment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckPayment() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/check-payment`)
      const data = await res.json()
      if (data.paid) {
        setStep('success')
      } else {
        setError('Pagamento ainda não identificado. Aguarde alguns instantes e tente novamente.')
      }
    } catch {
      setError('Erro ao verificar pagamento.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePayment() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/payment`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPaymentUrl(data.payment_url)
      window.open(data.payment_url, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar pagamento')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
        style={{ background: '#050505' }}>
        <ConfettiEffect />

        <div className="relative max-w-md w-full">
          {/* Card */}
          <div className="rounded-3xl p-10" style={{
            background: '#1A1A1D',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
          }}>
            {/* Ícone de sucesso */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl relative" style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))',
                border: '1px solid rgba(16,185,129,0.3)',
                boxShadow: '0 0 60px rgba(16,185,129,0.25)'
              }}>
                🎉
              </div>
            </div>

            <h1 className="text-4xl font-black text-white mb-3 tracking-tight">
              Tudo certo!
            </h1>

            <p className="text-lg mb-2" style={{color: 'rgba(255,255,255,0.6)'}}>
              Pagamento confirmado com sucesso
            </p>

            <p className="text-base mb-8" style={{color: 'rgba(255,255,255,0.4)'}}>
              Bem-vindo(a), <span className="text-white font-semibold">{proposal.client_name}</span>.
              <br/>Estamos animados para começar!
            </p>

            {/* Divisor */}
            <div className="mb-8 rounded-2xl p-4" style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)'
            }}>
              <p className="text-xs uppercase tracking-widest mb-1 font-semibold" style={{color: 'rgba(16,185,129,0.7)'}}>
                próximo passo
              </p>
              <p className="text-white text-sm">
                Agende sua sessão de onboarding para iniciarmos o projeto
              </p>
            </div>

            {/* Botão Calendly */}
            <a
              href={settings.calendly_url || '#'}
              target="_blank"
              className="flex items-center justify-center gap-3 w-full font-bold text-white rounded-2xl px-6 py-4 text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 8px 32px rgba(16,185,129,0.4), 0 0 0 1px rgba(255,255,255,0.1)'
              }}
            >
              <Calendar size={20} />
              Agendar onboarding
            </a>

            <p className="text-xs mt-4" style={{color: 'rgba(255,255,255,0.25)'}}>
              Você receberá um e-mail de confirmação em breve
            </p>

            <button
              onClick={() => setStep('proposal')}
              className="mt-4 w-full text-xs py-2 transition-colors"
              style={{color: 'rgba(255,255,255,0.25)'}}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              Revisar a proposta
            </button>
          </div>

          {/* Steps de progresso */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {['Proposta', 'Assinatura', 'Pagamento', 'Onboarding'].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{
                    background: i < 3 ? 'rgba(16,185,129,0.8)' : 'rgba(212,175,55,0.7)',
                    color: 'white',
                    boxShadow: i < 3 ? '0 0 8px rgba(16,185,129,0.4)' : '0 0 8px rgba(212,175,55,0.3)'
                  }}>
                    {i < 3 ? '✓' : '→'}
                  </div>
                  <span className="text-xs hidden sm:block" style={{
                    color: i < 3 ? 'rgba(16,185,129,0.8)' : 'rgba(255,255,255,0.5)'
                  }}>
                    {label}
                  </span>
                </div>
                {i < 3 && <div className="w-4 h-px" style={{background: 'rgba(255,255,255,0.1)'}} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'pricing') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10"
        style={{ background: '#050505' }}>
        <div className="max-w-lg w-full rounded-3xl p-8" style={{
          background: '#1A1A1D', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white mb-1">Monte seu pacote</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Selecione os itens opcionais. O total atualiza na hora.
            </p>
          </div>

          {/* Itens base */}
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-semibold">Projeto base (setup)</span>
              <span className="text-white font-black">{formatBRL(proposal.proposal_value)}</span>
            </div>
            {baseMonthly > 0 && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <span className="text-sm flex items-center gap-1.5" style={{ color: 'rgba(52,211,153,0.9)' }}>
                  <RefreshCw size={12} /> Mensalidade
                </span>
                <span className="font-bold" style={{ color: 'rgba(52,211,153,0.9)' }}>{formatBRL(baseMonthly)}/mês</span>
              </div>
            )}
          </div>

          {/* Add-ons */}
          {addons.length > 0 && (
            <div className="space-y-2 mb-5">
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Itens opcionais</p>
              {addons.map((a) => {
                const on = selectedAddons.includes(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleAddon(a.id)}
                    className="w-full text-left rounded-2xl p-4 transition-all duration-150 flex items-center gap-3"
                    style={{
                      background: on ? 'rgba(212,175,55,0.1)' : '#1A1A1D',
                      border: on ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center" style={{
                      background: on ? '#D4AF37' : 'rgba(255,255,255,0.06)',
                      border: on ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    }}>
                      {on && <Check size={13} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold">{a.name}</p>
                      {a.description && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{a.description}</p>}
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: a.recurring ? 'rgba(52,211,153,0.9)' : 'rgba(255,255,255,0.8)' }}>
                      +{formatBRL(a.price)}{a.recurring ? '/mês' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Total */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">Total à vista (setup)</span>
              <span className="text-2xl font-black text-white">{formatBRL(totals.setup)}</span>
            </div>
            {totals.monthly > 0 && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <span className="text-sm" style={{ color: 'rgba(52,211,153,0.9)' }}>Depois, mensalmente</span>
                <span className="text-lg font-black" style={{ color: 'rgba(52,211,153,0.9)' }}>{formatBRL(totals.monthly)}/mês</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setStep('signature')}
            className="w-full font-bold text-white rounded-2xl px-6 py-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: '#D4AF37', color: '#050505' }}
          >
            Continuar para assinatura →
          </button>
          <button onClick={() => setStep('proposal')} className="w-full text-xs py-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            ← Voltar para a proposta
          </button>
        </div>
      </div>
    )
  }

  if (step === 'signature') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#050505' }}>
        <div className="max-w-lg w-full">
          <div className="text-center mb-6">
            <h2 className="font-heading font-black uppercase text-white mb-2" style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>Assine a proposta</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>Use o mouse ou dedo para assinar no campo abaixo.</p>
          </div>

          {/* Checkbox de aceite */}
          <label className="flex items-start gap-3 mb-5 cursor-pointer rounded-xl p-4 transition-colors" style={{ background: '#1A1A1D', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: '#D4AF37' }}
            />
            <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Li e concordo com os <strong className="text-white">Termos e Condições</strong> e com o
              escopo descrito nesta proposta. Estou ciente de que minha assinatura eletrônica tem
              validade jurídica nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020.
            </span>
          </label>

          <SignatureCanvas onSign={handleSign} loading={loading} disabled={!accepted} />
          {!accepted && (
            <p className="mt-3 text-xs text-center text-amber-600">
              Marque a caixa de aceite acima para liberar a assinatura.
            </p>
          )}
          {error && (
            <p className="mt-4 text-sm text-center rounded-lg px-4 py-3" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </p>
          )}
          <button
            onClick={() => setStep(hasPricingStep ? 'pricing' : 'proposal')}
            className="mt-4 w-full text-sm transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            ← Voltar
          </button>
        </div>
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#050505' }}>

        <div className="relative w-full max-w-md">
          {/* Card principal */}
          <div className="rounded-3xl p-8 text-center" style={{
            background: '#1A1A1D',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
          }}>

            {/* Ícone animado */}
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl relative" style={{
                background: 'rgba(212,175,55,0.1)',
                border: '1px solid rgba(212,175,55,0.2)',
                boxShadow: '0 0 40px rgba(212,175,55,0.15)'
              }}>
                ✍️
              </div>
            </div>

            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
              Proposta assinada!
            </h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Confirme o investimento para darmos<br/>início ao seu projeto de automação.
            </p>

            {/* Valor em destaque */}
            <div className="rounded-2xl p-6 mb-8" style={{
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.2)',
            }}>
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-2 font-semibold">Setup (à vista)</p>
              <p className="text-4xl font-black text-white">
                {formatBRL((proposal as any).final_setup_value ?? totals.setup)}
              </p>
              {(((proposal as any).final_monthly_value ?? totals.monthly) > 0) && (
                <p className="text-sm mt-2 font-semibold" style={{ color: 'rgba(52,211,153,0.9)' }}>
                  + {formatBRL((proposal as any).final_monthly_value ?? totals.monthly)}/mês (assinatura)
                </p>
              )}
            </div>

            {error && (
              <div className="mb-5 rounded-xl px-4 py-3 text-sm" style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5'
              }}>
                {error}
              </div>
            )}

            <div className="space-y-3">
              {paymentUrl ? (
                <a
                  href={paymentUrl}
                  target="_blank"
                  className="flex items-center justify-center gap-2 w-full font-bold rounded-2xl px-6 py-4 text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: '#D4AF37',
                    color: '#050505',
                  }}
                >
                  <span>💳</span> Ir para o pagamento
                </a>
              ) : (
                <button
                  onClick={handleCreatePayment}
                  disabled={loading}
                  className="w-full font-bold rounded-2xl px-6 py-4 text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                  style={{
                    background: '#D4AF37',
                    color: '#050505',
                  }}
                >
                  {loading ? '⏳ Gerando cobrança...' : '💳 Realizar pagamento'}
                </button>
              )}

              <button
                onClick={handleCheckPayment}
                disabled={loading}
                className="w-full font-medium rounded-2xl px-6 py-3.5 text-sm transition-all duration-200 hover:scale-[1.01] disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)'
                }}
              >
                {loading ? 'Verificando pagamento...' : '✓ Já realizei o pagamento'}
              </button>

              <button
                onClick={() => setStep('proposal')}
                className="w-full text-xs py-2 transition-colors"
                style={{color: 'rgba(255,255,255,0.3)'}}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
              >
                ← Revisar a proposta
              </button>
            </div>
          </div>

          {/* Tags de segurança */}
          <div className="flex items-center justify-center gap-4 mt-5">
            {['🔒 Pagamento seguro', '🏦 Asaas', '✅ SSL'].map(tag => (
              <span key={tag} className="text-xs" style={{color: 'rgba(255,255,255,0.25)'}}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#050505' }}>
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl overflow-hidden shadow-xl">
          <ProposalTemplate
            proposal={proposal}
            content={content}
            editable={false}
            onCtaClick={startAccept}
            agencyName={settings.agency_name}
            agencyEmail={settings.email}
            agencyPhone={settings.phone}
            agencyInstagram={settings.instagram}
            yourName={settings.your_name}
            logoUrl={settings.logo_url}
            brandColor={settings.brand_color}
            legalName={settings.legal_name}
            cnpj={settings.cnpj}
            city={settings.city}
          />
        </div>
      </div>
    </div>
  )
}
