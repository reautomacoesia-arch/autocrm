'use client'

import { useState, useEffect } from 'react'
import type { Client } from '@/lib/types'
import { ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

interface DataTabProps {
  client: Client
  onClientUpdated: (client: Client) => void
}

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, '')
}

export default function DataTab({ client, onClientUpdated }: DataTabProps) {
  const [form, setForm] = useState({
    contact_name: client.contact_name ?? '',
    phone: client.phone ?? '',
    instagram: client.instagram ?? '',
    website: client.website ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setForm({
      contact_name: client.contact_name ?? '',
      phone: client.phone ?? '',
      instagram: client.instagram ?? '',
      website: client.website ?? '',
    })
  }, [client.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        instagram: form.instagram || null,
        website: form.website || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      onClientUpdated(updated)
      toast('Dados salvos')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSave} className="space-y-4">
        {/* Nome do contato */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nome do contato</label>
          <input
            type="text"
            value={form.contact_name}
            onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
            className="w-full bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            placeholder="Ex: João Silva"
          />
        </div>

        {/* WhatsApp */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">WhatsApp</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="flex-1 bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ex: (11) 99999-9999"
            />
            {form.phone && (
              <a
                href={`https://wa.me/55${cleanPhone(form.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 border border-slate-700 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <ExternalLink size={13} />
                Abrir
              </a>
            )}
          </div>
        </div>

        {/* Instagram */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Instagram</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))}
              className="flex-1 bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ex: @empresa"
            />
            {form.instagram && (
              <a
                href={`https://instagram.com/${form.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300 border border-slate-700 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <ExternalLink size={13} />
                Abrir
              </a>
            )}
          </div>
        </div>

        {/* Website */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Website</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.website}
              onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              className="flex-1 bg-[#1a1a1d] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Ex: https://empresa.com"
            />
            {form.website && (
              <a
                href={form.website.startsWith('http') ? form.website : `https://${form.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 border border-slate-700 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <ExternalLink size={13} />
                Abrir
              </a>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#050505] rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}
