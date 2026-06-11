import type { ConversationStatus, InboxChannel } from './types'

export const CHANNEL_LABELS: Record<InboxChannel, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
}

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Aberta',
  pending: 'Pendente',
  resolved: 'Resolvida',
}

export const STATUS_BADGE_VARIANT: Record<ConversationStatus, 'green' | 'yellow' | 'gray'> = {
  open: 'green',
  pending: 'yellow',
  resolved: 'gray',
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'agora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days}d`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
