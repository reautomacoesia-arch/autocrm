import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ServiceList from '@/components/services/ServiceList'
import type { Service } from '@/lib/types'

const mockServices: Service[] = [
  {
    id: '1',
    name: 'Chatbot WhatsApp',
    description: 'Automação de atendimento',
    default_price: 3500,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

describe('ServiceList', () => {
  it('renderiza nome do serviço', () => {
    render(<ServiceList initialServices={mockServices} />)
    expect(screen.getByText('Chatbot WhatsApp')).toBeInTheDocument()
  })

  it('mostra mensagem quando lista está vazia', () => {
    render(<ServiceList initialServices={[]} />)
    expect(screen.getByText('Nenhum serviço cadastrado ainda.')).toBeInTheDocument()
  })
})
