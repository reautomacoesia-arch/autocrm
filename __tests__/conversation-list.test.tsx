import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConversationList from '@/components/inbox/ConversationList'
import type { InboxConversation, Profile } from '@/lib/types'

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
]

const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

const conversations: InboxConversation[] = [
  {
    id: 'conv-1',
    channel: 'whatsapp',
    contact_name: 'João Silva',
    contact_handle: '+5511999999999',
    lead_id: null,
    client_id: null,
    status: 'open',
    assigned_to: 'user-1',
    last_message_at: fiveMinAgo,
    last_message_preview: 'Olá, tudo bem?',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: fiveMinAgo,
  },
  {
    id: 'conv-2',
    channel: 'instagram',
    contact_name: 'Maria Souza',
    contact_handle: '@mariasouza',
    lead_id: 'lead-1',
    client_id: null,
    status: 'resolved',
    assigned_to: null,
    last_message_at: null,
    last_message_preview: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
]

describe('ConversationList', () => {
  it('renderiza as conversas com canal, status e preview', () => {
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={vi.fn()}
      />
    )

    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getAllByText('WhatsApp')).toHaveLength(2) // filtro + badge
    expect(screen.getAllByText('Instagram')).toHaveLength(2) // filtro + badge
    expect(screen.getByText('Olá, tudo bem?')).toBeInTheDocument()
    expect(screen.getByText('Aberta')).toBeInTheDocument()
    expect(screen.getByText('Resolvida')).toBeInTheDocument()
  })

  it('exibe "Sem vínculo" para conversas sem lead/cliente', () => {
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={vi.fn()}
      />
    )

    expect(screen.getByText('Sem vínculo')).toBeInTheDocument()
  })

  it('filtra por busca de contact_name', () => {
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={vi.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Buscar conversa...'), {
      target: { value: 'Maria' },
    })

    expect(screen.queryByText('João Silva')).not.toBeInTheDocument()
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
  })

  it('filtro "Minhas" mostra apenas conversas do usuário logado', () => {
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Minhas'))

    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument()
  })

  it('chama onSelect ao clicar em uma conversa', () => {
    const onSelect = vi.fn()
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={onSelect}
        onNewConversation={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('João Silva'))

    expect(onSelect).toHaveBeenCalledWith('conv-1')
  })

  it('chama onNewConversation ao clicar em "+ Nova conversa"', () => {
    const onNewConversation = vi.fn()
    render(
      <ConversationList
        conversations={conversations}
        profiles={profiles}
        currentUserId="user-1"
        selectedId={null}
        onSelect={vi.fn()}
        onNewConversation={onNewConversation}
      />
    )

    fireEvent.click(screen.getByText('+ Nova conversa'))

    expect(onNewConversation).toHaveBeenCalled()
  })
})
