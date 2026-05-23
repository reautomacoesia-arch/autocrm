import { createClient } from '@/lib/supabase/server'
import TaskList from '@/components/tasks/TaskList'
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
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold">Tarefas</h1>
        <p className="text-slate-400 text-sm mt-1">{pendingCount} pendente(s)</p>
      </div>
      <TaskList initialTasks={tasks} clients={clients} onTaskAdded={() => {}} />
    </div>
  )
}
