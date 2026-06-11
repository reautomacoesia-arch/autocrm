import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import ConversationThread from '@/components/inbox/ConversationThread'
import type { InboxConversation, InboxMessage, Profile } from '@/lib/types'

const conversation: InboxConversation = {
  id: 'conv-1',
  channel: 'whatsapp',
  contact_name: 'João Silva',
  contact_handle: '+5511999999999',
  lead_id: null,
  client_id: null,
  status: 'open',
  assigned_to: null,
  last_message_at: '2026-06-11T14:00:00.000Z',
  last_message_preview: 'Oi',
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-11T14:00:00.000Z',
}

const profiles: Profile[] = [
  {
    id: 'user-1',
    name: 'Ana Lima',
    email: 'ana@autocrm.com',
    avatar_color: '#6366f1',
    avatar_url: null,
    bio: null,
    phone: null,
    birth_date: null,
    role: 'admin',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-2',
    name: 'Bruno Costa',
    email: 'bruno@autocrm.com',
    avatar_color: '#f59e0b',
    avatar_url: null,
    bio: null,
    phone: null,
    birth_date: null,
    role: 'member',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
]

const messages: InboxMessage[] = [
  {
    id: 'msg-1',
    conversation_id: 'conv-1',
    direction: 'inbound',
    content: 'Olá, quero saber mais',
    attachment_r2_key: null,
    attachment_name: null,
    attachment_mime_type: null,
    attachment_size: null,
    sender_id: null,
    created_at: '2026-06-11T13:00:00.000Z',
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-1',
    direction: 'outbound',
    content: 'Claro! Como posso ajudar?',
    attachment_r2_key: null,
    attachment_name: null,
    attachment_mime_type: null,
    attachment_size: null,
    sender_id: 'user-1',
    created_at: '2026-06-11T13:05:00.000Z',
  },
]

function buildProps(
  overrides: Partial<ComponentProps<typeof ConversationThread>> = {}
): ComponentProps<typeof ConversationThread> {
  return {
    conversation,
    messages,
    profiles,
    attachmentUrls: {},
    linkedEntity: null,
    onSendMessage: vi.fn(),
    onUpdateStatus: vi.fn(),
    onUpdateAssignee: vi.fn(),
    onLinkClick: vi.fn(),
    onCreateLead: vi.fn(),
    ...overrides,
  }
}

describe('ConversationThread', () => {
  it('renderiza o nome do contato e o badge do canal', () => {
    render(<ConversationThread {...buildProps()} />)

    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
  })

  it('exibe chip de vínculo com Lead quando vinculada', () => {
    render(
      <ConversationThread
        {...buildProps({ linkedEntity: { type: 'lead', id: 'lead-1', name: 'João Silva' } })}
      />
    )

    const chip = screen.getByRole('link', { name: '→ Lead: João Silva' })
    expect(chip).toHaveAttribute('href', '/pipeline')
  })

  it('exibe botões de vínculo e criar lead quando não vinculada', () => {
    const onLinkClick = vi.fn()
    const onCreateLead = vi.fn()
    render(<ConversationThread {...buildProps({ onLinkClick, onCreateLead })} />)

    fireEvent.click(screen.getByText('Vincular a Lead/Cliente'))
    expect(onLinkClick).toHaveBeenCalled()

    fireEvent.click(screen.getByText('+ Criar Lead'))
    expect(onCreateLead).toHaveBeenCalled()
  })

  it('chama onUpdateStatus ao alterar o dropdown de status', () => {
    const onUpdateStatus = vi.fn()
    render(<ConversationThread {...buildProps({ onUpdateStatus })} />)

    fireEvent.change(screen.getByDisplayValue('Aberta'), { target: { value: 'resolved' } })

    expect(onUpdateStatus).toHaveBeenCalledWith('resolved')
  })

  it('chama onUpdateAssignee ao alterar o dropdown de responsável', () => {
    const onUpdateAssignee = vi.fn()
    render(<ConversationThread {...buildProps({ onUpdateAssignee })} />)

    fireEvent.change(screen.getByDisplayValue('Sem responsável'), { target: { value: 'user-2' } })

    expect(onUpdateAssignee).toHaveBeenCalledWith('user-2')
  })

  it('renderiza as mensagens da conversa', () => {
    render(<ConversationThread {...buildProps()} />)

    expect(screen.getByText('Olá, quero saber mais')).toBeInTheDocument()
    expect(screen.getByText('Claro! Como posso ajudar?')).toBeInTheDocument()
    expect(screen.getByText('· Ana Lima')).toBeInTheDocument()
  })

  it('composer: registra mensagem com direção "Mensagem do contato" quando selecionada', () => {
    const onSendMessage = vi.fn()
    render(<ConversationThread {...buildProps({ onSendMessage })} />)

    fireEvent.click(screen.getByText('Mensagem do contato'))
    fireEvent.change(screen.getByPlaceholderText('Digite a mensagem...'), {
      target: { value: 'Recebi um pedido' },
    })
    fireEvent.click(screen.getByText('Registrar'))

    expect(onSendMessage).toHaveBeenCalledWith({
      direction: 'inbound',
      content: 'Recebi um pedido',
      file: null,
    })
  })

  it('composer: registra mensagem outbound por padrão e limpa o campo', () => {
    const onSendMessage = vi.fn()
    render(<ConversationThread {...buildProps({ onSendMessage })} />)

    const textarea = screen.getByPlaceholderText('Digite a mensagem...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Resposta da equipe' } })
    fireEvent.click(screen.getByText('Registrar'))

    expect(onSendMessage).toHaveBeenCalledWith({
      direction: 'outbound',
      content: 'Resposta da equipe',
      file: null,
    })
    expect(textarea.value).toBe('')
  })

  it('composer: exibe erro ao registrar sem conteúdo nem anexo', () => {
    const onSendMessage = vi.fn()
    render(<ConversationThread {...buildProps({ onSendMessage })} />)

    fireEvent.click(screen.getByText('Registrar'))

    expect(screen.getByText('Digite uma mensagem ou anexe um arquivo.')).toBeInTheDocument()
    expect(onSendMessage).not.toHaveBeenCalled()
  })

  it('composer: anexa um arquivo e exibe o nome', () => {
    render(<ConversationThread {...buildProps()} />)

    const file = new File(['conteudo'], 'foto.png', { type: 'image/png' })
    const input = screen.getByLabelText('Anexar arquivo')
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText('foto.png')).toBeInTheDocument()
  })
})
