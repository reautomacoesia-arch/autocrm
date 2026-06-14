import type { WorkflowTriggerType, WorkflowCondition, WorkflowAction } from './workflow-catalog'

export type LeadStage = 'lead' | 'contacted' | 'proposal_sent' | 'negotiating' | 'won' | 'lost'
export type ClientStatus = 'active' | 'inactive' | 'churned'
export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected'
export type ProjectStatus = 'in_progress' | 'completed' | 'paused' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TransactionType = 'received' | 'pending'
export type InteractionType = 'note' | 'meeting' | 'email' | 'task_update'
export type InboxChannel = 'whatsapp' | 'instagram' | 'facebook'
export type ConversationStatus = 'open' | 'pending' | 'resolved'
export type MessageDirection = 'inbound' | 'outbound'

export interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  stage: LeadStage
  estimated_value: number
  notes: string | null
  instagram: string | null
  website: string | null
  source: string | null
  next_step: string | null
  score?: number | null
  score_reason?: string | null
  scored_at?: string | null
  created_at: string
  updated_at: string
}

export const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  indicacao: 'Indicação',
  site: 'Site',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  outro: 'Outro',
}

export interface Client {
  id: string
  lead_id: string | null
  name: string
  company: string | null
  email: string | null
  phone: string | null
  monthly_value: number
  status: ClientStatus
  started_at: string | null
  referred_by: string | null
  instagram: string | null
  website: string | null
  contact_name: string | null
  is_internal: boolean
  created_at: string
  updated_at: string
}

export interface Onboarding {
  id: string
  client_id: string
  segment: string | null
  team_size: string | null
  current_tools: string | null
  main_pain: string | null
  accesses: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  client_id: string
  name: string
  status: ProjectStatus
  description: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  name: string
  description: string | null
  default_price: number
  created_at: string
  updated_at: string
}

export interface Proposal {
  id: string
  client_id: string | null
  lead_id: string | null
  value: number
  status: ProposalStatus
  valid_until: string | null
  notes: string | null
  external_id: string | null
  external_url: string | null
  created_at: string
  updated_at: string
}

export interface ProposalItem {
  id: string
  proposal_id: string
  service_id: string | null
  custom_description: string | null
  price: number
  created_at: string
}

export interface Transaction {
  id: string
  client_id: string
  amount: number
  type: TransactionType
  date: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  description: string
  amount: number
  category: string | null
  date: string
  recurring: boolean
  recurring_day: number | null
  recurring_key: string | null
  parent_id: string | null
  client_id: string | null
  created_at: string
  updated_at: string
}

export const EXPENSE_CATEGORIES = [
  'Aluguel',
  'Salários',
  'Ferramentas/Software',
  'Impostos',
  'Marketing',
  'Serviços',
  'Pró-labore',
  'Outros',
] as const

export interface Profile {
  id: string
  name: string
  email: string | null
  avatar_color: string
  avatar_url: string | null
  bio: string | null
  phone: string | null
  birth_date: string | null
  role: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  client_id: string | null
  lead_id: string | null
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  status: TaskStatus
  assigned_to: string | null
  assigned_to_id: string | null
  assigned_to_ids: string[]
  tags: string[]
  created_at: string
  updated_at: string
}

export interface TaskChecklistItem {
  id: string
  task_id: string
  checklist_id: string | null
  text: string
  done: boolean
  position: number
  created_at: string
}

export interface TaskChecklist {
  id: string
  task_id: string
  title: string
  position: number
  created_at: string
}

export interface TaskChecklistWithItems extends TaskChecklist {
  items: TaskChecklistItem[]
}

export interface TaskComment {
  id: string
  task_id: string
  body: string
  author: string
  created_at: string
}

export interface Interaction {
  id: string
  client_id: string
  type: InteractionType
  description: string
  happened_at: string
  created_at: string
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url'
export type CustomFieldEntityType = 'client' | 'lead'

export interface CustomFieldDefinition {
  id: string
  entity_type: CustomFieldEntityType
  name: string
  field_type: CustomFieldType
  options: string[] | null
  sort_order: number
  created_at: string
}

export interface CustomFieldValue {
  id: string
  definition_id: string
  entity_id: string
  value: string | null
  created_at: string
  updated_at: string
}

export interface FieldWithValue {
  definition: CustomFieldDefinition
  value: string | null
}

export interface AutomationConfig {
  id: string
  automation_key: string
  enabled: boolean
  config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface AutomationWorkflow {
  id: string
  name: string
  trigger_type: WorkflowTriggerType
  enabled: boolean
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  key: string | null
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

export interface InboxConversation {
  id: string
  channel: InboxChannel
  contact_name: string
  contact_handle: string | null
  lead_id: string | null
  client_id: string | null
  status: ConversationStatus
  assigned_to: string | null
  last_message_at: string | null
  last_message_preview: string | null
  ai_enabled: boolean
  created_at: string
  updated_at: string
}

export interface InboxMessage {
  id: string
  conversation_id: string
  direction: MessageDirection
  content: string | null
  attachment_r2_key: string | null
  attachment_name: string | null
  attachment_mime_type: string | null
  attachment_size: number | null
  sender_id: string | null
  is_ai: boolean
  created_at: string
}
