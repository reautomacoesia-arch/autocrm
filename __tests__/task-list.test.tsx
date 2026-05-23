import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TaskList from '@/components/tasks/TaskList'
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

describe('TaskList', () => {
  it('renderiza o título da tarefa', () => {
    render(<TaskList initialTasks={mockTasks} clients={[]} onTaskAdded={vi.fn()} />)
    expect(screen.getByText('Enviar proposta para João')).toBeInTheDocument()
  })

  it('mostra mensagem quando não há tarefas', () => {
    render(<TaskList initialTasks={[]} clients={[]} onTaskAdded={vi.fn()} />)
    expect(screen.getByText('Nenhuma tarefa pendente.')).toBeInTheDocument()
  })
})
