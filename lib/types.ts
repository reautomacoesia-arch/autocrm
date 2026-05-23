export type LeadStage = 'lead' | 'contacted' | 'proposal_sent' | 'negotiating' | 'won' | 'lost'
export type ClientStatus = 'active' | 'inactive' | 'churned'
export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected'
export type ProjectStatus = 'in_progress' | 'completed' | 'paused' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TransactionType = 'received' | 'pending'
export type InteractionType = 'note' | 'meeting' | 'email'

export interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  stage: LeadStage
  estimated_value: number
  notes: string | null
  created_at: string
  updated_at: string
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

export interface Task {
  id: string
  client_id: string | null
  lead_id: string | null
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
}

export interface Interaction {
  id: string
  client_id: string
  type: InteractionType
  description: string
  happened_at: string
  created_at: string
}
