import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import KanbanColumn from '@/components/pipeline/KanbanColumn'
import { ConfirmProvider } from '@/components/ui/ConfirmModal'
import type { Lead, PipelineStage } from '@/lib/types'

// Mock @hello-pangea/dnd
vi.mock('@hello-pangea/dnd', () => ({
  Droppable: ({ children }: { children: (provided: object, snapshot: object) => React.ReactNode }) =>
    children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }, { isDraggingOver: false }),
  Draggable: ({ children }: { children: (provided: object, snapshot: object) => React.ReactNode }) =>
    children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}))

const mockLead: Lead = {
  id: '1',
  name: 'João Silva',
  company: 'Empresa Teste',
  email: 'joao@teste.com',
  phone: null,
  instagram: null,
  website: null,
  stage: 'lead',
  estimated_value: 5000,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockStage: PipelineStage = {
  id: 's1',
  slug: 'lead',
  label: 'Lead',
  color: '#64748b',
  type: 'open',
  probability: 0.1,
  position: 0,
  created_at: '2026-01-01T00:00:00Z',
}

function renderWithProviders(ui: React.ReactElement) {
  return render(<ConfirmProvider>{ui}</ConfirmProvider>)
}

describe('KanbanColumn', () => {
  it('renderiza o título da coluna', () => {
    renderWithProviders(
      <KanbanColumn stage={mockStage} leads={[mockLead]} stagesBySlug={{ lead: mockStage }} onCardEdit={vi.fn()} onCardDelete={vi.fn()} onCardUpdated={vi.fn()} />
    )
    expect(screen.getByText('Lead')).toBeInTheDocument()
  })

  it('mostra a contagem de leads', () => {
    renderWithProviders(
      <KanbanColumn stage={mockStage} leads={[mockLead]} stagesBySlug={{ lead: mockStage }} onCardEdit={vi.fn()} onCardDelete={vi.fn()} onCardUpdated={vi.fn()} />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renderiza o nome do lead', () => {
    renderWithProviders(
      <KanbanColumn stage={mockStage} leads={[mockLead]} stagesBySlug={{ lead: mockStage }} onCardEdit={vi.fn()} onCardDelete={vi.fn()} onCardUpdated={vi.fn()} />
    )
    expect(screen.getByText('João Silva')).toBeInTheDocument()
  })
})
