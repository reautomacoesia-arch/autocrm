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
  /** Como o gatilho é acionado (evento manual ou cron automático) */
  trigger: string
  /** Bullet points explicando o que a automação faz na prática */
  details: string[]
  /** Exemplo concreto de quando seria útil */
  example: string
  badge: string
  fields: AutomationField[]
}

export const AUTOMATION_DEFINITIONS: AutomationDefinition[] = [
  {
    key: 'lead_won',
    name: 'Lead convertido em cliente',
    description: 'Dispara quando um lead vai para o estágio "Ganho".',
    trigger: 'Evento — ao mover lead para Ganho no pipeline',
    details: [
      'Cria automaticamente uma tarefa de onboarding vinculada ao novo cliente',
      'Registra no sino que um novo cliente foi conquistado',
      'Opcional: gera uma transação recorrente no Financeiro com o valor mensal',
    ],
    example: 'Lead "Empresa X" marcado como Ganho → tarefa "Iniciar onboarding" criada + notificação disparada automaticamente.',
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
    trigger: 'Evento — ao mudar status da proposta para Aprovada',
    details: [
      'Cria uma tarefa de follow-up para garantir que o próximo passo seja dado',
      'Notifica no sino para registrar a aprovação e acionar o responsável',
    ],
    example: 'Proposta de R$ 3.000/mês aprovada → tarefa "Follow-up pós-aprovação" criada com prioridade média.',
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
    trigger: 'Evento — ao mover lead para Perdido no pipeline',
    details: [
      'Registra uma nota no histórico do lead para documentar a perda',
      'Serve como memória para revisitar o lead futuramente',
      'Opcional: notifica o time para análise interna',
    ],
    example: 'Lead perdido para concorrente → nota automática "Retomar contato em 90 dias" salva no histórico.',
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
    trigger: 'Evento — ao alterar status do cliente para Inativo ou Churned',
    details: [
      'Cria uma tarefa de reengajamento para não deixar o cliente sair sem tentativa de retenção',
      'Notifica o time imediatamente para que o responsável seja acionado',
      'Ajuda a manter o histórico de clientes perdidos organizado',
    ],
    example: 'Cliente "Agência Y" marcado como Churned → tarefa "Reengajar cliente" criada com prioridade alta + notificação.',
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
    trigger: 'Automático — cron diário às 09h (horário de Brasília)',
    details: [
      'Verifica todas as propostas com status "Enviada" que não foram atualizadas nos últimos X dias',
      'Cria uma tarefa de follow-up vinculada ao cliente ou lead da proposta',
      'Envia notificação no sino com link direto para a proposta',
      'Uma única notificação por proposta — não fica repetindo todo dia',
    ],
    example: 'Proposta enviada há 7 dias para "João Silva" sem resposta → tarefa de follow-up criada + sino ativado com link para a proposta.',
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
    trigger: 'Automático — cron diário às 09h (horário de Brasília)',
    details: [
      'Verifica clientes ativos que não tiveram nenhuma interação registrada (nota, reunião ou e-mail) no período configurado',
      'Cria tarefa de follow-up para retomar o contato antes do relacionamento esfriar',
      'Notifica no sino uma vez por mês por cliente — não fica gerando spam',
      'Ideal para garantir que nenhum cliente fique sem atenção por muito tempo',
    ],
    example: 'Cliente "Loja Z" sem nenhuma nota ou reunião registrada nos últimos 30 dias → tarefa "Retomar contato" criada + notificação mensal.',
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
    description: 'Tarefa com prazo de entrega vencido e ainda não concluída.',
    trigger: 'Automático — cron diário às 09h (horário de Brasília)',
    details: [
      'Verifica todas as tarefas com data de entrega vencida que ainda estão como Pendente ou Em andamento',
      'Envia notificação no sino com link direto para a lista de tarefas',
      'Uma notificação por tarefa — não repete se já foi disparada para aquela tarefa',
      'Configure o número mínimo de dias em atraso para evitar alertas prematuros',
    ],
    example: 'Tarefa "Entregar relatório mensal" com prazo ontem ainda Pendente → notificação no sino com link para Tarefas.',
    badge: '🔴',
    fields: [
      { key: 'days_threshold', type: 'number', label: 'Dias em atraso para alertar', default: 1 },
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
