'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/pipeline'
import { RefreshCw, Settings2, X } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

export interface RecurringBillingClient {
  id: string
  name: string
  company: string | null
  monthly_value: number
  billing_day: number | null
}

interface RecurringBillingPanelProps {
  clients: RecurringBillingClient[]
  mrr: number
}

/**
 * Painel de configuração: cobrança recorrente por cliente (MRR).
 * Permite configurar o dia do mês em que o cron gera automaticamente
 * uma transação pendente com o valor mensal de cada cliente.
 */
export default function RecurringBillingPanel({ clients, mrr }: RecurringBillingPanelProps) {
  const { toast } = useToast()

  const [recurringDays, setRecurringDays] = useState<Record<string, number | null>>(
    () => Object.fromEntries(clients.map((c) => [c.id, c.billing_day])),
  )
  const [configuringRecurringId, setConfiguringRecurringId] = useState<string | null>(null)
  const [recurringDayInput, setRecurringDayInput] = useState<string>('')
  const [recurringLoading, setRecurringLoading] = useState(false)

  async function handleSaveRecurring(clientId: string, day: number | null) {
    setRecurringLoading(true)
    const res = await fetch(`/api/clients/${clientId}/billing`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billing_day: day }),
    })
    if (res.ok) {
      setRecurringDays((prev) => ({ ...prev, [clientId]: day }))
      setConfiguringRecurringId(null)
      toast(
        day
          ? `Dia ${day} configurado — cobrança automática ativa`
          : 'Recorrência removida',
      )
    } else {
      toast('Erro ao salvar configuração', 'error')
    }
    setRecurringLoading(false)
  }

  if (clients.length === 0) return null

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Cobrança recorrente por cliente
          </h2>
          <p className="text-white text-lg font-bold mt-1">
            {formatCurrency(mrr)}
            <span className="text-slate-500 text-xs font-normal ml-2">MRR · {clients.length} cliente(s) ativo(s)</span>
          </p>
        </div>
        {clients.some((c) => recurringDays[c.id]) && (
          <span className="flex items-center gap-1 text-emerald-500 text-xs">
            <RefreshCw size={10} />
            {clients.filter((c) => recurringDays[c.id]).length} com cobrança automática
          </span>
        )}
      </div>
      <div className="space-y-2">
        {clients.map((client) => {
          const billingDay = recurringDays[client.id]
          const isConfiguring = configuringRecurringId === client.id

          return (
            <div
              key={client.id}
              className="bg-[#1a1a1d] border border-slate-700 rounded-lg px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{client.name}</p>
                  {client.company && (
                    <p className="text-slate-400 text-xs">{client.company}</p>
                  )}
                  {billingDay ? (
                    <p className="flex items-center gap-1 text-emerald-600 text-xs mt-0.5">
                      <RefreshCw size={9} />
                      Cobrança automática todo dia {billingDay}
                    </p>
                  ) : (
                    <p className="text-slate-700 text-xs mt-0.5">Sem recorrência automática</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="text-emerald-400 text-sm font-semibold">
                    {formatCurrency(client.monthly_value)}/mês
                  </p>
                  <button
                    onClick={() => {
                      if (isConfiguring) {
                        setConfiguringRecurringId(null)
                      } else {
                        setRecurringDayInput(billingDay ? String(billingDay) : '')
                        setConfiguringRecurringId(client.id)
                      }
                    }}
                    title="Configurar cobrança automática"
                    className={`transition-colors ${
                      isConfiguring
                        ? 'text-indigo-400'
                        : billingDay
                        ? 'text-emerald-600 hover:text-emerald-400'
                        : 'text-slate-600 hover:text-slate-300'
                    }`}
                  >
                    {isConfiguring ? <X size={13} /> : <Settings2 size={13} />}
                  </button>
                </div>
              </div>

              {isConfiguring && (
                <div className="mt-3 pt-3 border-t border-slate-700/60">
                  <p className="text-slate-400 text-xs mb-2">
                    O cron diário gera automaticamente uma transação <strong className="text-slate-300">Pendente</strong> com o valor mensal do cliente no dia escolhido.
                  </p>
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        Dia do mês (1–28)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="28"
                        value={recurringDayInput}
                        onChange={(e) => setRecurringDayInput(e.target.value)}
                        placeholder="Ex: 5"
                        className="w-24 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      onClick={() =>
                        handleSaveRecurring(
                          client.id,
                          recurringDayInput ? parseInt(recurringDayInput) : null,
                        )
                      }
                      disabled={recurringLoading || !recurringDayInput}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-[#050505] text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {recurringLoading ? '...' : 'Ativar'}
                    </button>
                    {billingDay && (
                      <button
                        onClick={() => handleSaveRecurring(client.id, null)}
                        disabled={recurringLoading}
                        className="text-red-500 hover:text-red-400 disabled:opacity-40 text-sm px-2 py-1.5 transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
