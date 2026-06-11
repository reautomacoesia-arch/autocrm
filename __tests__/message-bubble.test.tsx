import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MessageBubble from '@/components/inbox/MessageBubble'
import type { InboxMessage } from '@/lib/types'

function buildMessage(overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    direction: 'outbound',
    content: null,
    attachment_r2_key: null,
    attachment_name: null,
    attachment_mime_type: null,
    attachment_size: null,
    sender_id: null,
    created_at: '2026-06-11T14:30:00.000Z',
    ...overrides,
  }
}

describe('MessageBubble', () => {
  it('renderiza mensagem de texto outbound com nome do remetente', () => {
    render(
      <MessageBubble
        message={buildMessage({ content: 'Olá, como posso ajudar?' })}
        senderName="Ana Lima"
        attachmentUrl={null}
      />
    )

    expect(screen.getByText('Olá, como posso ajudar?')).toBeInTheDocument()
    expect(screen.getByText('· Ana Lima')).toBeInTheDocument()
  })

  it('renderiza mensagem de texto inbound sem nome do remetente', () => {
    render(
      <MessageBubble
        message={buildMessage({ direction: 'inbound', content: 'Quero saber mais' })}
        senderName={null}
        attachmentUrl={null}
      />
    )

    expect(screen.getByText('Quero saber mais')).toBeInTheDocument()
    expect(screen.queryByText(/·/)).not.toBeInTheDocument()
  })

  it('exibe o horário formatado da mensagem', () => {
    const createdAt = '2026-06-11T14:30:00.000Z'
    const expectedTime = new Date(createdAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    render(
      <MessageBubble
        message={buildMessage({ content: 'Oi', created_at: createdAt })}
        senderName={null}
        attachmentUrl={null}
      />
    )

    expect(screen.getByText(expectedTime)).toBeInTheDocument()
  })

  it('renderiza imagem como thumbnail clicável e abre lightbox', () => {
    render(
      <MessageBubble
        message={buildMessage({
          attachment_r2_key: 'inbox/conv-1/foto.png',
          attachment_name: 'foto.png',
          attachment_mime_type: 'image/png',
          attachment_size: 1024,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/foto.png"
      />
    )

    const thumbnail = screen.getByAltText('foto.png')
    expect(thumbnail).toHaveAttribute('src', 'https://r2.example.com/foto.png')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(thumbnail)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renderiza vídeo com player inline', () => {
    const { container } = render(
      <MessageBubble
        message={buildMessage({
          attachment_r2_key: 'inbox/conv-1/video.mp4',
          attachment_name: 'video.mp4',
          attachment_mime_type: 'video/mp4',
          attachment_size: 2048,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/video.mp4"
      />
    )

    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', 'https://r2.example.com/video.mp4')
  })

  it('renderiza áudio com player inline', () => {
    const { container } = render(
      <MessageBubble
        message={buildMessage({
          attachment_r2_key: 'inbox/conv-1/audio.mp3',
          attachment_name: 'audio.mp3',
          attachment_mime_type: 'audio/mpeg',
          attachment_size: 4096,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/audio.mp3"
      />
    )

    const audio = container.querySelector('audio')
    expect(audio).toHaveAttribute('src', 'https://r2.example.com/audio.mp3')
  })

  it('renderiza anexo genérico com nome, tamanho e link de download', () => {
    render(
      <MessageBubble
        message={buildMessage({
          attachment_r2_key: 'inbox/conv-1/contrato.pdf',
          attachment_name: 'contrato.pdf',
          attachment_mime_type: 'application/pdf',
          attachment_size: 204800,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/contrato.pdf"
      />
    )

    expect(screen.getByText('contrato.pdf')).toBeInTheDocument()
    expect(screen.getByText('200.0 KB')).toBeInTheDocument()

    const link = screen.getByRole('link', { name: 'Baixar anexo' })
    expect(link).toHaveAttribute('href', 'https://r2.example.com/contrato.pdf')
  })

  it('renderiza content junto com anexo quando ambos presentes', () => {
    render(
      <MessageBubble
        message={buildMessage({
          content: 'Segue o contrato',
          attachment_r2_key: 'inbox/conv-1/contrato.pdf',
          attachment_name: 'contrato.pdf',
          attachment_mime_type: 'application/pdf',
          attachment_size: 204800,
        })}
        senderName={null}
        attachmentUrl="https://r2.example.com/contrato.pdf"
      />
    )

    expect(screen.getByText('Segue o contrato')).toBeInTheDocument()
    expect(screen.getByText('contrato.pdf')).toBeInTheDocument()
  })
})
