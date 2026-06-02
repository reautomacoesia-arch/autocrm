import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ServiceList from '@/components/services/ServiceList'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmModal'
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

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </ToastProvider>
  )
}

describe('ServiceList', () => {
  it('renderiza nome do serviço', () => {
    renderWithProviders(<ServiceList initialServices={mockServices} />)
    expect(screen.getByText('Chatbot WhatsApp')).toBeInTheDocument()
  })

  it('mostra mensagem quando lista está vazia', () => {
    renderWithProviders(<ServiceList initialServices={[]} />)
    expect(screen.getByText('Nenhum serviço cadastrado')).toBeInTheDocument()
  })
})
