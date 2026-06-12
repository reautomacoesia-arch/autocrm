/**
 * Catálogo de gatilhos, campos e ações do motor de automações plugável (Fase 4).
 * Compartilhado entre a UI (builder em /automations) e o motor (lib/workflow-engine.ts).
 */

export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'

export type WorkflowTriggerType = 'lead.stage_changed' | 'proposal.status_changed' | 'client.status_changed'

export interface WorkflowCondition {
  field: string
  operator: ConditionOperator
  value: string
}

export interface WorkflowAction {
  type: string
  params: Record<string, string>
}

export interface TriggerField {
  key: string
  label: string
  /** Se definido, o campo aceita apenas estes valores (estágios/status) */
  options?: { value: string; label: string }[]
}

export interface TriggerDefinition {
  type: WorkflowTriggerType
  label: string
  description: string
  fields: TriggerField[]
}

const LEAD_STAGE_OPTIONS = [
  { value: 'lead', label: 'Lead' },
  { value: 'contacted', label: 'Contato feito' },
  { value: 'proposal_sent', label: 'Proposta enviada' },
  { value: 'negotiating', label: 'Negociando' },
  { value: 'won', label: 'Fechado ✓' },
  { value: 'lost', label: 'Perdido ✗' },
]

const PROPOSAL_STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent', label: 'Enviada' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'rejected', label: 'Rejeitada' },
]

const CLIENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'churned', label: 'Churned' },
]

export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
  {
    type: 'lead.stage_changed',
    label: 'Lead mudou de estágio',
    description: 'Dispara sempre que um lead é movido para outro estágio no pipeline.',
    fields: [
      { key: 'toStage', label: 'Novo estágio', options: LEAD_STAGE_OPTIONS },
      { key: 'fromStage', label: 'Estágio anterior', options: LEAD_STAGE_OPTIONS },
      { key: 'estimatedValue', label: 'Valor estimado (R$)' },
      { key: 'source', label: 'Origem do lead' },
      { key: 'leadName', label: 'Nome do lead' },
    ],
  },
  {
    type: 'proposal.status_changed',
    label: 'Proposta mudou de status',
    description: 'Dispara sempre que o status de uma proposta é alterado.',
    fields: [
      { key: 'toStatus', label: 'Novo status', options: PROPOSAL_STATUS_OPTIONS },
      { key: 'fromStatus', label: 'Status anterior', options: PROPOSAL_STATUS_OPTIONS },
      { key: 'value', label: 'Valor da proposta (R$)' },
    ],
  },
  {
    type: 'client.status_changed',
    label: 'Cliente mudou de status',
    description: 'Dispara sempre que o status de um cliente é alterado (ativo/inativo/churned).',
    fields: [
      { key: 'toStatus', label: 'Novo status', options: CLIENT_STATUS_OPTIONS },
      { key: 'fromStatus', label: 'Status anterior', options: CLIENT_STATUS_OPTIONS },
      { key: 'clientName', label: 'Nome do cliente' },
      { key: 'monthlyValue', label: 'Mensalidade (R$)' },
    ],
  },
]

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'é igual a',
  neq: 'é diferente de',
  gt: 'é maior que',
  gte: 'é maior ou igual a',
  lt: 'é menor que',
  lte: 'é menor ou igual a',
  contains: 'contém',
}

export interface ActionParamDefinition {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface ActionDefinition {
  type: string
  label: string
  description: string
  params: ActionParamDefinition[]
}

export const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    type: 'create_task',
    label: 'Criar tarefa',
    description: 'Cria uma nova tarefa vinculada ao lead/cliente do evento.',
    params: [
      { key: 'title', label: 'Título', type: 'text', placeholder: 'Ex: Follow-up com {{leadName}}' },
      {
        key: 'priority', label: 'Prioridade', type: 'select',
        options: [{ value: 'high', label: 'Alta' }, { value: 'medium', label: 'Média' }, { value: 'low', label: 'Baixa' }],
      },
    ],
  },
  {
    type: 'create_notification',
    label: 'Criar notificação',
    description: 'Cria uma notificação in-app (sino).',
    params: [
      { key: 'title', label: 'Título', type: 'text', placeholder: 'Ex: {{leadName}} virou cliente!' },
      { key: 'link', label: 'Link (opcional)', type: 'text', placeholder: '/pipeline' },
    ],
  },
  {
    type: 'send_email',
    label: 'Enviar e-mail',
    description: 'Envia um e-mail de alerta para o endereço configurado (NOTIFICATION_EMAIL).',
    params: [
      { key: 'subject', label: 'Assunto', type: 'text', placeholder: 'Ex: Novo lead qualificado: {{leadName}}' },
      { key: 'body', label: 'Mensagem', type: 'textarea' },
    ],
  },
  {
    type: 'send_whatsapp',
    label: 'Enviar WhatsApp',
    description: 'Envia uma mensagem de WhatsApp para o contato do evento (via UAZAPI). Só funciona se o lead/cliente tiver telefone cadastrado.',
    params: [
      { key: 'message', label: 'Mensagem', type: 'textarea', placeholder: 'Ex: Olá {{leadName}}, tudo certo?' },
    ],
  },
]

export function getTrigger(type: string): TriggerDefinition | undefined {
  return TRIGGER_DEFINITIONS.find((t) => t.type === type)
}

export function getAction(type: string): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((a) => a.type === type)
}
