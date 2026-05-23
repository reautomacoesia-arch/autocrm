import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('Sidebar', () => {
  it('renderiza todos os itens de navegação', () => {
    render(<Sidebar />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.getByText('Propostas')).toBeInTheDocument()
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    expect(screen.getByText('Tarefas')).toBeInTheDocument()
    expect(screen.getByText('Serviços')).toBeInTheDocument()
  })

  it('exibe o nome do sistema', () => {
    render(<Sidebar />)
    expect(screen.getByText('AutoCRM')).toBeInTheDocument()
  })
})
