'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { Sparkles } from 'lucide-react'

interface ClientSummaryButtonProps {
  clientId: string
}

export default function ClientSummaryButton({ clientId }: ClientSummaryButtonProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  async function handleOpen() {
    setIsOpen(true)
    setSummary(null)
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/summary`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSummary(data.summary)
    } else {
      setSummary(null)
      toast(data.error ?? 'Erro ao gerar resumo', 'error')
      setIsOpen(false)
    }
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title="Resumo por IA"
        className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-400 border border-slate-700 hover:border-indigo-600 rounded-lg px-3 py-1.5 text-xs transition-colors"
      >
        <Sparkles size={13} />
        Me atualiza
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Resumo por IA" size="lg">
        {loading ? (
          <p className="text-slate-400 text-sm">Gerando resumo...</p>
        ) : (
          <p className="text-slate-200 text-sm whitespace-pre-line leading-relaxed">{summary}</p>
        )}
      </Modal>
    </>
  )
}
