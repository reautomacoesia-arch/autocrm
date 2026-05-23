import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClientList from '@/components/clients/ClientList'
import type { Client } from '@/lib/types'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockClients: Client[] = [
  {
    id: '1',
    lead_id: null,
    name: 'João Silva',
    company: 'Empresa ABC',
    email: null,
    phone: null,
    monthly_value: 3000,
    status: 'active',
    started_at: null,
    referred_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    lead_id: null,
    name: 'Maria Santos',
    company: 'XYZ Ltda',
    email: null,
    phone: null,
    monthly_value: 0,
    status: 'inactive',
    started_at: null,
    referred_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

describe('ClientList', () => {
  it('renderiza todos os clientes', () => {
    render(<ClientList clients={mockClients} />)
    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
  })

  it('filtra clientes pelo nome', async () => {
    render(<ClientList clients={mockClients} />)
    const input = screen.getByPlaceholderText('Buscar cliente ou empresa...')
    await userEvent.type(input, 'João')
    expect(screen.getByText('João Silva')).toBeInTheDocument()
    expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument()
  })

  it('mostra mensagem quando busca não tem resultados', async () => {
    render(<ClientList clients={mockClients} />)
    const input = screen.getByPlaceholderText('Buscar cliente ou empresa...')
    await userEvent.type(input, 'zzz')
    expect(screen.getByText('Nenhum cliente encontrado.')).toBeInTheDocument()
  })
})
