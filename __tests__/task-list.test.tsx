import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TaskList from '@/components/tasks/TaskList'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { ConfirmProvider } from '@/components/ui/ConfirmModal'
import type { Task } from '@/lib/types'

const mockTasks: Task[] = [
  {
    id: '1',
    client_id: null,
    lead_id: null,
    title: 'Enviar proposta para João',
    description: null,
    priority: 'high',
    due_date: null,
    status: 'pending',
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

describe('TaskList', () => {
  it('renderiza o título da tarefa', () => {
    renderWithProviders(<TaskList initialTasks={mockTasks} clients={[]} onTaskAdded={vi.fn()} />)
    expect(screen.getByText('Enviar proposta para João')).toBeInTheDocument()
  })

  it('mostra mensagem quando não há tarefas', () => {
    renderWithProviders(<TaskList initialTasks={[]} clients={[]} onTaskAdded={vi.fn()} />)
    expect(screen.getByText('Nenhuma tarefa ainda')).toBeInTheDocument()
  })
})
