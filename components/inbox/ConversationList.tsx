'use client'

import { useState } from 'react'
import type { ConversationStatus, InboxChannel, InboxConversation, Profile } from '@/lib/types'
import { CHANNEL_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANT, timeAgo } from '@/lib/inbox'
import ProfileAvatar, { getInitials } from '@/components/team/ProfileAvatar'
import Badge from '@/components/ui/Badge'
import { Search, MessageCircle, Camera, ThumbsUp, type LucideIcon } from 'lucide-react'

const CHANNEL_ICONS: Record<InboxChannel, LucideIcon> = {
  whatsapp: MessageCircle,
  instagram: Camera,
  facebook: ThumbsUp,
}

type StatusFilter = 'all' | 'mine' | ConversationStatus
type ChannelFilter = 'all' | InboxChannel

interface ConversationListProps {
  conversations: InboxConversation[]
  profiles: Profile[]
  currentUserId: string
  selectedId: string | null
  onSelect: (id: string) => void
  onNewConversation: () => void
}

export default function ConversationList({
  conversations,
  profiles,
  currentUserId,
  selectedId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')

  const filtered = conversations
    .filter((c) => {
      if (!search) return true
      const term = search.toLowerCase()
      return (
        c.contact_name.toLowerCase().includes(term) ||
        (c.contact_handle ?? '').toLowerCase().includes(term)
      )
    })
    .filter((c) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'mine') return c.assigned_to === currentUserId
      return c.status === statusFilter
    })
    .filter((c) => channelFilter === 'all' || c.channel === channelFilter)

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-lg font-bold">Inbox</h1>
          <button
            onClick={onNewConversation}
            className="bg-indigo-600 hover:bg-indigo-500 text-[#050505] text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            + Nova conversa
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full bg-[#050505] border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {([
            ['all', 'Todas'],
            ['mine', 'Minhas'],
            ['open', 'Abertas'],
            ['pending', 'Pendentes'],
            ['resolved', 'Resolvidas'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                statusFilter === value
                  ? 'bg-indigo-600 text-[#050505]'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {([
            ['all', 'Todos'],
            ['whatsapp', 'WhatsApp'],
            ['instagram', 'Instagram'],
            ['facebook', 'Facebook'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setChannelFilter(value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors border ${
                channelFilter === value
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-700/50'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm px-4">
            Nenhuma conversa encontrada.
          </div>
        ) : (
          filtered.map((conv) => {
            const ChannelIcon = CHANNEL_ICONS[conv.channel]
            const assignedProfile = profiles.find((p) => p.id === conv.assigned_to)
            const isUnlinked = !conv.lead_id && !conv.client_id

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 border-b border-slate-800 text-left transition-colors ${
                  selectedId === conv.id ? 'bg-indigo-600/10' : 'hover:bg-slate-700/30'
                }`}
              >
                <div className="w-9 h-9 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-400 font-semibold text-sm flex-shrink-0">
                  {getInitials(conv.contact_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{conv.contact_name}</p>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <ChannelIcon size={10} />
                        {CHANNEL_LABELS[conv.channel]}
                      </span>
                    </div>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-slate-500 flex-shrink-0">{timeAgo(conv.last_message_at)}</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs truncate mt-0.5">
                    {conv.last_message_preview ?? 'Sem mensagens'}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant={STATUS_BADGE_VARIANT[conv.status]}>{STATUS_LABELS[conv.status]}</Badge>
                    {isUnlinked && (
                      <span className="text-[10px] text-slate-500">Sem vínculo</span>
                    )}
                    {assignedProfile && (
                      <ProfileAvatar name={assignedProfile.name} color={assignedProfile.avatar_color} avatarUrl={assignedProfile.avatar_url} size="sm" className="ml-auto" />
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
