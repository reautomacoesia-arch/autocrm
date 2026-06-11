'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type {
  ConversationStatus,
  InboxChannel,
  InboxConversation,
  InboxMessage,
  MessageDirection,
  Profile,
} from '@/lib/types'
import { CHANNEL_LABELS, STATUS_LABELS } from '@/lib/inbox'
import MessageBubble from './MessageBubble'
import { getInitials } from '@/components/team/ProfileAvatar'
import { Paperclip, Send, X, MessageCircle, Camera, ThumbsUp, type LucideIcon } from 'lucide-react'

const CHANNEL_ICONS: Record<InboxChannel, LucideIcon> = {
  whatsapp: MessageCircle,
  instagram: Camera,
  facebook: ThumbsUp,
}

export interface SendMessageData {
  direction: MessageDirection
  content: string | null
  file: File | null
}

export interface LinkedEntity {
  type: 'lead' | 'client'
  id: string
  name: string
}

interface ConversationThreadProps {
  conversation: InboxConversation
  messages: InboxMessage[]
  profiles: Profile[]
  attachmentUrls: Record<string, string>
  linkedEntity: LinkedEntity | null
  onSendMessage: (data: SendMessageData) => void
  onUpdateStatus: (status: ConversationStatus) => void
  onUpdateAssignee: (assignedTo: string | null) => void
  onLinkClick: () => void
  onCreateLead: () => void
}

export default function ConversationThread({
  conversation,
  messages,
  profiles,
  attachmentUrls,
  linkedEntity,
  onSendMessage,
  onUpdateStatus,
  onUpdateAssignee,
  onLinkClick,
  onCreateLead,
}: ConversationThreadProps) {
  const [direction, setDirection] = useState<MessageDirection>('outbound')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  const ChannelIcon = CHANNEL_ICONS[conversation.channel]

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  function handleSend() {
    const trimmed = content.trim()
    if (!trimmed && !file) {
      setError('Digite uma mensagem ou anexe um arquivo.')
      return
    }
    onSendMessage({ direction, content: trimmed || null, file })
    setContent('')
    setFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 font-semibold text-sm flex-shrink-0">
            {getInitials(conversation.contact_name)}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{conversation.contact_name}</p>
            <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full w-fit">
              <ChannelIcon size={10} />
              {CHANNEL_LABELS[conversation.channel]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {linkedEntity ? (
            <Link
              href={linkedEntity.type === 'lead' ? '/pipeline' : `/clients/${linkedEntity.id}`}
              className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-600/10 border border-indigo-700/50 rounded-full px-3 py-1"
            >
              → {linkedEntity.type === 'lead' ? 'Lead' : 'Cliente'}: {linkedEntity.name}
            </Link>
          ) : (
            <>
              <button
                onClick={onLinkClick}
                className="text-xs text-slate-300 border border-slate-700 rounded-full px-3 py-1 hover:border-slate-600"
              >
                Vincular a Lead/Cliente
              </button>
              <button
                onClick={onCreateLead}
                className="text-xs text-indigo-400 border border-indigo-700/50 bg-indigo-600/10 rounded-full px-3 py-1 hover:bg-indigo-600/20"
              >
                + Criar Lead
              </button>
            </>
          )}

          <select
            value={conversation.status}
            onChange={(e) => onUpdateStatus(e.target.value as ConversationStatus)}
            className="bg-[#050505] border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="open">{STATUS_LABELS.open}</option>
            <option value="pending">{STATUS_LABELS.pending}</option>
            <option value="resolved">{STATUS_LABELS.resolved}</option>
          </select>

          <select
            value={conversation.assigned_to ?? ''}
            onChange={(e) => onUpdateAssignee(e.target.value || null)}
            className="bg-[#050505] border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">Nenhuma mensagem ainda.</div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              senderName={profiles.find((p) => p.id === msg.sender_id)?.name ?? null}
              attachmentUrl={attachmentUrls[msg.id] ?? null}
            />
          ))
        )}
      </div>

      <div className="border-t border-slate-700 p-3 space-y-2">
        <div className="flex gap-1.5">
          <button
            onClick={() => setDirection('inbound')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              direction === 'inbound'
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Mensagem do contato
          </button>
          <button
            onClick={() => setDirection('outbound')}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              direction === 'outbound'
                ? 'bg-indigo-600 text-[#050505]'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Minha resposta
          </button>
        </div>

        {file && (
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 w-fit">
            {file.name}
            <button
              onClick={() => setFile(null)}
              aria-label="Remover anexo"
              className="text-slate-500 hover:text-slate-300"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite a mensagem..."
            rows={2}
            className="flex-1 bg-[#050505] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
          />
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            aria-label="Anexar arquivo"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Selecionar anexo"
            className="text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg p-2"
          >
            <Paperclip size={16} />
          </button>
          <button
            onClick={handleSend}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Send size={14} />
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}
