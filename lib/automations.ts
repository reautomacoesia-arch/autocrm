export type FieldType = 'checkbox' | 'text' | 'number' | 'select'

export interface AutomationField {
  key: string
  type: FieldType
  label: string
  default: unknown
  options?: string[]
  dependsOn?: string
  disabled?: boolean
}

export interface AutomationDefinition {
  key: string
  name: string
  description: string
  badge: string
  fields: AutomationField[]
}

export const AUTOMATION_DEFINITIONS: AutomationDefinition[] = [
  {
    key: 'lead_won',
    name: 'Lead convertido em cliente',
    description: 'Dispara quando um lead vai para o estágio "Ganho".',
    badge: '🏆',
    fields: [
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de onboarding', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Iniciar onboarding', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'high', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'create_transaction', type: 'checkbox', label: 'Criar transação recorrente', default: false },
      { key: 'transaction_amount', type: 'number', label: 'Valor da transação (R$)', default: 0, dependsOn: 'create_transaction' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
      { key: 'send_email', type: 'checkbox', label: 'Enviar e-mail (em breve)', default: false, disabled: true },
    ],
  },
  {
    key: 'proposal_approved',
    name: 'Proposta aprovada',
    description: 'Dispara quando uma proposta é marcada como aprovada.',
    badge: '✅',
    fields: [
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de follow-up', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Follow-up pós-aprovação', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'medium', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
  {
    key: 'lead_lost',
    name: 'Lead perdido',
    description: 'Dispara quando um lead vai para o estágio "Perdido".',
    badge: '❌',
    fields: [
      { key: 'create_note', type: 'checkbox', label: 'Registrar nota automática', default: true },
      { key: 'note_text', type: 'text', label: 'Texto da nota', default: 'Lead perdido. Retomar contato em 90 dias.', dependsOn: 'create_note' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: false },
    ],
  },
  {
    key: 'client_churned',
    name: 'Cliente pausado ou churned',
    description: 'Dispara quando um cliente é marcado como Inativo ou Churned.',
    badge: '⚠️',
    fields: [
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de reengajamento', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Reengajar cliente', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'high', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
  {
    key: 'proposal_no_response',
    name: 'Proposta sem resposta',
    description: 'Proposta enviada há X dias sem mudança de status.',
    badge: '⏰',
    fields: [
      { key: 'days_threshold', type: 'number', label: 'Dias sem resposta', default: 7 },
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de follow-up', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Follow-up: proposta sem resposta', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'high', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
  {
    key: 'client_no_contact',
    name: 'Cliente sem contato',
    description: 'Cliente ativo sem nenhuma interação registrada há X dias.',
    badge: '🔕',
    fields: [
      { key: 'days_threshold', type: 'number', label: 'Dias sem contato', default: 30 },
      { key: 'create_task', type: 'checkbox', label: 'Criar tarefa de follow-up', default: true },
      { key: 'task_title', type: 'text', label: 'Título da tarefa', default: 'Retomar contato com cliente', dependsOn: 'create_task' },
      { key: 'task_priority', type: 'select', label: 'Prioridade', default: 'medium', options: ['high', 'medium', 'low'], dependsOn: 'create_task' },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
  {
    key: 'task_overdue',
    name: 'Tarefas em atraso',
    description: 'Tarefa com prazo vencido há pelo menos X dias.',
    badge: '🔴',
    fields: [
      { key: 'days_threshold', type: 'number', label: 'Dias em atraso', default: 1 },
      { key: 'notify', type: 'checkbox', label: 'Criar notificação in-app', default: true },
    ],
  },
]

export const AUTOMATION_DEFAULTS: Record<string, Record<string, unknown>> = Object.fromEntries(
  AUTOMATION_DEFINITIONS.map((def) => [
    def.key,
    Object.fromEntries(def.fields.map((f) => [f.key, f.default])),
  ])
)

export const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}
