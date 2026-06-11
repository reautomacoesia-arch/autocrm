'use client'

import { useEffect, useState } from 'react'
import type {
  Client,
  ConversationStatus,
  InboxConversation,
  InboxMessage,
  Lead,
  Profile,
} from '@/lib/types'
import ConversationList from './ConversationList'
import ConversationThread, { type LinkedEntity, type SendMessageData } from './ConversationThread'
import NewConversationModal from './NewConversationModal'
import LinkLeadModal, { type LinkSelection } from './LinkLeadModal'
import { useToast } from '@/components/ui/ToastProvider'
import EmptyState from '@/components/ui/EmptyState'

interface InboxClientProps {
  initialConversations: InboxConversation[]
  profiles: Profile[]
  initialClients: Client[]
  initialLeads: Lead[]
  currentUserId: string
  initialSelectedId: string | null
}

export default function InboxClient({
  initialConversations,
  profiles,
  initialClients,
  initialLeads,
  currentUserId,
  initialSelectedId,
}: InboxClientProps) {
  const { toast } = useToast()
  const [conversations, setConversations] = useState<InboxConversation[]>(initialConversations)
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null

  // Polling: lista de conversas a cada 15s
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/inbox/conversations')
      if (res.ok) setConversations(await res.json())
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  // Polling: mensagens da conversa aberta a cada 5s
  useEffect(() => {
    let cancelled = false

    if (!selectedId) {
      queueMicrotask(() => {
        if (!cancelled) setMessages([])
      })
      return () => {
        cancelled = true
      }
    }

    async function load() {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/messages`)
      if (res.ok && !cancelled) setMessages(await res.json())
    }

    load()
    const interval = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [selectedId])

  // Resolve URLs assinadas para anexos ainda não carregados
  useEffect(() => {
    const pending = messages.filter((m) => m.attachment_r2_key && !attachmentUrls[m.id])
    if (pending.length === 0) return

    let cancelled = false

    async function loadUrls() {
      const entries = await Promise.all(
        pending.map(async (m) => {
          const res = await fetch(`/api/inbox/messages/${m.id}/attachment?preview=true`)
          if (!res.ok) return null
          const data = await res.json()
          return [m.id, data.url] as const
        })
      )

      if (cancelled) return

      setAttachmentUrls((prev) => {
        const next = { ...prev }
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1]
        }
        return next
      })
    }

    loadUrls()

    return () => {
      cancelled = true
    }
  }, [messages, attachmentUrls])

  function getLinkedEntity(conversation: InboxConversation): LinkedEntity | null {
    if (conversation.lead_id) {
      const lead = leads.find((l) => l.id === conversation.lead_id)
      return lead ? { type: 'lead', id: lead.id, name: lead.name } : null
    }
    if (conversation.client_id) {
      const client = clients.find((c) => c.id === conversation.client_id)
      return client ? { type: 'client', id: client.id, name: client.name } : null
    }
    return null
  }

  async function handleSendMessage(data: SendMessageData) {
    if (!selectedId) return

    let attachment: { r2_key: string; name: string; mime_type: string; size: number } | null = null

    if (data.file) {
      const presignRes = await fetch(`/api/inbox/conversations/${selectedId}/messages/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.file.name,
          size: data.file.size,
          mime_type: data.file.type,
        }),
      })

      if (!presignRes.ok) {
        toast('Erro ao preparar envio do anexo.', 'error')
        return
      }

      const { upload_url, r2_key } = await presignRes.json()

      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': data.file.type },
        body: data.file,
      })

      if (!uploadRes.ok) {
        toast('Erro ao enviar anexo.', 'error')
        return
      }

      attachment = { r2_key, name: data.file.name, mime_type: data.file.type, size: data.file.size }
    }

    const res = await fetch(`/api/inbox/conversations/${selectedId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: data.direction,
        content: data.content,
        attachment_r2_key: attachment?.r2_key ?? null,
        attachment_name: attachment?.name ?? null,
        attachment_mime_type: attachment?.mime_type ?? null,
        attachment_size: attachment?.size ?? null,
      }),
    })

    if (!res.ok) {
      toast('Erro ao registrar mensagem.', 'error')
      return
    }

    const message: InboxMessage = await res.json()
    setMessages((prev) => [...prev, message])
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              last_message_at: message.created_at,
              last_message_preview: message.content ?? '[Anexo]',
            }
          : c
      )
    )
  }

  async function handleUpdateStatus(status: ConversationStatus) {
    if (!selectedId) return
    const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      toast('Erro ao atualizar status.', 'error')
      return
    }
    const updated: InboxConversation = await res.json()
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  async function handleUpdateAssignee(assignedTo: string | null) {
    if (!selectedId) return
    const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: assignedTo }),
    })
    if (!res.ok) {
      toast('Erro ao atualizar responsável.', 'error')
      return
    }
    const updated: InboxConversation = await res.json()
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  async function handleLink(selection: LinkSelection) {
    if (!selectedId) return
    const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        selection.type === 'lead' ? { lead_id: selection.id } : { client_id: selection.id }
      ),
    })
    if (!res.ok) {
      toast('Erro ao vincular conversa.', 'error')
      return
    }
    const updated: InboxConversation = await res.json()
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setIsLinkModalOpen(false)
    toast('Conversa vinculada com sucesso.')
  }

  async function handleCreateLead() {
    if (!selectedId) return
    const res = await fetch(`/api/inbox/conversations/${selectedId}/lead`, { method: 'POST' })
    if (!res.ok) {
      toast('Erro ao criar lead.', 'error')
      return
    }
    const { lead, conversation }: { lead: Lead; conversation: InboxConversation } = await res.json()
    setLeads((prev) => [...prev, lead])
    setConversations((prev) => prev.map((c) => (c.id === conversation.id ? conversation : c)))
    toast('Lead criado e vinculado à conversa.')
  }

  function handleCreated(conversation: InboxConversation) {
    setConversations((prev) => [conversation, ...prev])
    setSelectedId(conversation.id)
    setIsNewModalOpen(false)
  }

  return (
    <div className="flex h-full">
      <div className="w-[340px] border-r border-slate-700 flex-shrink-0">
        <ConversationList
          conversations={conversations}
          profiles={profiles}
          currentUserId={currentUserId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewConversation={() => setIsNewModalOpen(true)}
        />
      </div>

      <div className="flex-1 min-w-0">
        {selectedConversation ? (
          <ConversationThread
            conversation={selectedConversation}
            messages={messages}
            profiles={profiles}
            attachmentUrls={attachmentUrls}
            linkedEntity={getLinkedEntity(selectedConversation)}
            onSendMessage={handleSendMessage}
            onUpdateStatus={handleUpdateStatus}
            onUpdateAssignee={handleUpdateAssignee}
            onLinkClick={() => setIsLinkModalOpen(true)}
            onCreateLead={handleCreateLead}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon="💬"
              title="Selecione uma conversa"
              description="Escolha uma conversa na lista ao lado ou inicie uma nova."
              action={{ label: '+ Nova conversa', onClick: () => setIsNewModalOpen(true) }}
            />
          </div>
        )}
      </div>

      <NewConversationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        clients={clients}
        leads={leads}
        onCreated={handleCreated}
      />

      <LinkLeadModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        clients={clients}
        leads={leads}
        onLink={handleLink}
      />
    </div>
  )
}
