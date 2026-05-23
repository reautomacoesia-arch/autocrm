'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import type { Client, Service } from '@/lib/types'
import { formatCurrency } from '@/lib/pipeline'
import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ProposalItem {
  service_id: string | null
  custom_description: string
  price: string
}

interface CreateProposalModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  services: Service[]
  defaultClientId?: string
}

export default function CreateProposalModal({
  isOpen,
  onClose,
  clients,
  services,
  defaultClientId,
}: CreateProposalModalProps) {
  const router = useRouter()
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ProposalItem[]>([
    { service_id: null, custom_description: '', price: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalValue = items.reduce((sum, item) => {
    const p = parseFloat(item.price)
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  function addItem() {
    setItems((prev) => [...prev, { service_id: null, custom_description: '', price: '' }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof ProposalItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (field === 'service_id') {
          const service = services.find((s) => s.id === value)
          return {
            ...item,
            service_id: value || null,
            custom_description: service?.name ?? item.custom_description,
            price: service && service.default_price > 0 ? String(service.default_price) : item.price,
          }
        }
        return { ...item, [field]: value }
      })
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.some((i) => !i.price)) {
      setError('Todos os itens precisam de um preço.')
      return
    }
    setLoading(true)
    setError(null)

    const proposalRes = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId || null,
        value: totalValue,
        valid_until: validUntil || null,
        notes: notes || null,
      }),
    })

    if (!proposalRes.ok) {
      setError('Erro ao criar proposta.')
      setLoading(false)
      return
    }

    const proposal = await proposalRes.json()

    await Promise.all(
      items.map((item) =>
        fetch(`/api/proposals/${proposal.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: item.service_id,
            custom_description: item.custom_description || null,
            price: parseFloat(item.price),
          }),
        })
      )
    )

    onClose()
    router.push(`/proposals/${proposal.id}`)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Proposta" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {clients.length > 0 && (
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Cliente</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `— ${c.company}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs text-slate-400 uppercase tracking-wider">Itens</label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <Plus size={12} /> Adicionar item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <select
                    value={item.service_id ?? ''}
                    onChange={(e) => updateItem(index, 'service_id', e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Serviço personalizado</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.default_price > 0 ? `— ${formatCurrency(s.default_price)}` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={item.custom_description}
                    onChange={(e) => updateItem(index, 'custom_description', e.target.value)}
                    placeholder="Descrição do item"
                    className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="w-28 flex-shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={item.price}
                    onChange={(e) => updateItem(index, 'price', e.target.value)}
                    placeholder="R$ 0"
                    className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-slate-600 hover:text-red-400 transition-colors mt-1.5"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {totalValue > 0 && (
            <div className="text-right mt-2">
              <span className="text-emerald-400 text-sm font-semibold">
                Total: {formatCurrency(totalValue)}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Válida até</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-[#0f172a] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={2}
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-slate-400 border border-slate-700 rounded-lg py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium"
          >
            {loading ? 'Criando...' : 'Criar Proposta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
