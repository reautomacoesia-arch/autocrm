'use client'

import { useState } from 'react'
import type { InboxMessage } from '@/lib/types'
import { formatFileSize } from '@/lib/inbox'
import { File, Download, X, Bot, Trash2 } from 'lucide-react'

interface MessageBubbleProps {
  message: InboxMessage
  senderName: string | null
  attachmentUrl: string | null
  onDelete?: (id: string) => void
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, senderName, attachmentUrl, onDelete }: MessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const isOutbound = message.direction === 'outbound'
  const mime = message.attachment_mime_type ?? ''
  const isImage = mime.startsWith('image/')
  const isVideo = mime.startsWith('video/')
  const isAudio = mime.startsWith('audio/')
  const isGenericFile = message.attachment_r2_key !== null && !isImage && !isVideo && !isAudio

  return (
    <div
      className={`flex items-end gap-1.5 group ${isOutbound ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isOutbound && onDelete && (
        <button
          onClick={() => onDelete(message.id)}
          title="Apagar mensagem"
          className={`p-1 text-slate-600 hover:text-red-400 transition-all flex-shrink-0 ${hovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <Trash2 size={13} />
        </button>
      )}
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 ${
          isOutbound
            ? 'bg-indigo-600 text-[#050505]'
            : 'bg-[#1a1a1d] text-white border border-slate-700'
        }`}
      >
        {message.attachment_r2_key && (
          <div className="mb-1.5">
            {isImage && attachmentUrl && (
              <>
                <img
                  src={attachmentUrl}
                  alt={message.attachment_name ?? 'Anexo'}
                  onClick={() => setLightboxOpen(true)}
                  className="max-w-full max-h-60 rounded cursor-pointer"
                />
                {lightboxOpen && (
                  <div
                    role="dialog"
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
                    onClick={() => setLightboxOpen(false)}
                  >
                    <img
                      src={attachmentUrl}
                      alt={message.attachment_name ?? 'Anexo'}
                      className="max-w-[90vw] max-h-[90vh]"
                    />
                    <button
                      onClick={() => setLightboxOpen(false)}
                      aria-label="Fechar"
                      className="absolute top-4 right-4 text-white"
                    >
                      <X size={24} />
                    </button>
                  </div>
                )}
              </>
            )}

            {isVideo && attachmentUrl && (
              <video src={attachmentUrl} controls className="max-w-full max-h-60 rounded" />
            )}

            {isAudio && attachmentUrl && (
              <audio src={attachmentUrl} controls className="max-w-full" />
            )}

            {isGenericFile && (
              <div className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
                <File size={16} className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{message.attachment_name}</p>
                  {message.attachment_size !== null && (
                    <p className="text-[10px] opacity-70">{formatFileSize(message.attachment_size)}</p>
                  )}
                </div>
                {attachmentUrl && (
                  <a
                    href={attachmentUrl}
                    download={message.attachment_name ?? undefined}
                    aria-label="Baixar anexo"
                    className="flex-shrink-0"
                  >
                    <Download size={16} />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}

        <div className="flex items-center gap-1.5 mt-1">
          {message.is_ai && (
            <span className="flex items-center gap-1 text-[10px] opacity-70">
              <Bot size={10} /> IA
            </span>
          )}
          <span className="text-[10px] opacity-60">{formatTime(message.created_at)}</span>
          {isOutbound && senderName && <span className="text-[10px] opacity-60">· {senderName}</span>}
        </div>
      </div>
      {!isOutbound && onDelete && (
        <button
          onClick={() => onDelete(message.id)}
          title="Apagar mensagem"
          className={`p-1 text-slate-600 hover:text-red-400 transition-all flex-shrink-0 ${hovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
