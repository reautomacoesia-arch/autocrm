import { createClient } from '@/lib/supabase/server'
import TaskList from '@/components/tasks/TaskList'
import PageHeader from '@/components/ui/PageHeader'
import type { Client, Task } from '@/lib/types'

export default async function TasksPage() {
  const supabase = await createClient()

  const [tasksRes, clientsRes] = await Promise.all([
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name, company').eq('status', 'active').order('name'),
  ])

  const tasks = (tasksRes.data as Task[]) ?? []
  const clients = (clientsRes.data as Client[]) ?? []
  const pendingCount = tasks.filter((t) => t.status !== 'done').length

  return (
    <div>
      <PageHeader title="Tarefas" subtitle={`${pendingCount} pendente(s)`} />
      <TaskList initialTasks={tasks} clients={clients} />
    </div>
  )
}
