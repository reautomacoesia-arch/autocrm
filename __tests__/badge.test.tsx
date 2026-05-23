import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from '@/components/ui/Badge'

describe('Badge', () => {
  it('renderiza o texto corretamente', () => {
    render(<Badge>Ativo</Badge>)
    expect(screen.getByText('Ativo')).toBeInTheDocument()
  })

  it('renderiza com variante green', () => {
    render(<Badge variant="green">Ativo</Badge>)
    const badge = screen.getByText('Ativo')
    expect(badge.className).toContain('emerald')
  })
})
