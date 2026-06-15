import { z } from 'zod'

// Campos auxiliares — limites generosos, mas suficientes para barrar abuso.
const text = (max: number) => z.string().max(max)
const optText = (max: number) => z.string().max(max).nullish()
const money = z.number().finite().min(0).max(1_000_000_000)
const uuid = z.uuid()
const optUuid = uuid.nullish()
const dateStr = z.string().max(40)

// ---------- Leads ----------
// Estágio agora é o slug de um pipeline_stages dinâmico (não mais enum fixo).
export const leadStageSchema = text(100).min(1)

export const leadCreateSchema = z.object({
  name: text(200).min(1),
  company: optText(200),
  email: optText(320),
  phone: optText(50),
  stage: leadStageSchema.optional(),
  estimated_value: money.nullish(),
  notes: optText(5000),
  instagram: optText(200),
  website: optText(500),
  source: optText(200),
  next_step: optText(500),
})

export const leadUpdateSchema = leadCreateSchema.partial().extend({
  instagram: optText(200),
  website: optText(500),
  clientId: optUuid,
})

export const leadConvertSchema = z.object({
  monthly_value: money.nullish(),
  referred_by: optText(200),
})

// ---------- Pipeline Stages ----------
export const pipelineStageTypeEnum = z.enum(['open', 'won', 'lost'])

export const pipelineStageCreateSchema = z.object({
  label: text(100).min(1),
  color: text(20).optional(),
  type: pipelineStageTypeEnum.optional(),
  probability: z.number().min(0).max(1).optional(),
})

export const pipelineStageUpdateSchema = z.object({
  label: text(100).min(1).optional(),
  color: text(20).optional(),
  type: pipelineStageTypeEnum.optional(),
  probability: z.number().min(0).max(1).optional(),
})

export const pipelineStageReorderSchema = z.object({
  ids: z.array(uuid).min(1).max(100),
})

// ---------- Clients ----------
export const clientStatusEnum = z.enum(['active', 'inactive', 'churned'])

export const clientCreateSchema = z.object({
  name: text(200).min(1),
  company: optText(200),
  email: optText(320),
  phone: optText(50),
  monthly_value: money.nullish(),
  status: clientStatusEnum.optional(),
})

export const clientUpdateSchema = clientCreateSchema.partial().extend({
  instagram: optText(200),
  website: optText(500),
  contact_name: optText(200),
  is_internal: z.boolean().optional(),
})

export const billingSchema = z.object({
  billing_day: z.number().int().min(1).max(28).nullish(),
})

export const onboardingSchema = z.object({
  segment: optText(500),
  team_size: optText(200),
  current_tools: optText(2000),
  main_pain: optText(5000),
  accesses: optText(5000),
  notes: optText(5000),
})

export const interactionCreateSchema = z.object({
  type: z.enum(['note', 'meeting', 'email', 'task_update']),
  description: optText(5000),
  happened_at: dateStr.optional(),
})

// ---------- Projects ----------
export const projectStatusEnum = z.enum([
  'in_progress', 'completed', 'paused', 'cancelled',
])

export const projectCreateSchema = z.object({
  name: text(200).min(1),
  description: optText(2000),
  status: projectStatusEnum.optional(),
})

export const projectUpdateSchema = z.object({
  name: text(200).min(1),
  description: optText(2000),
  status: projectStatusEnum,
})

// ---------- Transactions ----------
export const transactionTypeEnum = z.enum(['received', 'pending'])

export const transactionCreateSchema = z.object({
  client_id: uuid,
  amount: z.number().finite(),
  type: transactionTypeEnum,
  date: dateStr,
  description: optText(1000),
})

export const transactionUpdateSchema = transactionCreateSchema.omit({ client_id: true })

// ---------- Expenses ----------
export const expenseCreateSchema = z.object({
  description: text(300).min(1),
  amount: z.number().finite(),
  category: optText(100),
  date: dateStr,
  recurring: z.boolean().optional(),
  recurring_day: z.number().int().min(1).max(31).nullish(),
  client_id: optUuid,
})

export const expenseUpdateSchema = expenseCreateSchema.partial()

// ---------- Importação em massa (planilha) ----------
export const expenseImportRowSchema = z.object({
  description: text(300).min(1),
  amount: money,
  category: optText(100),
  date: dateStr,
  client_id: optUuid,
})

export const expenseImportSchema = z.object({
  rows: z.array(expenseImportRowSchema).min(1).max(1000),
})

export const transactionImportRowSchema = z.object({
  client_id: uuid,
  amount: money,
  type: transactionTypeEnum,
  date: dateStr,
  description: optText(1000),
})

export const transactionImportSchema = z.object({
  rows: z.array(transactionImportRowSchema).min(1).max(1000),
})

// ---------- Services ----------
export const serviceCreateSchema = z.object({
  name: text(200).min(1),
  description: optText(2000),
  default_price: money.nullish(),
})

export const serviceUpdateSchema = serviceCreateSchema.partial()

// ---------- Proposals ----------
export const proposalStatusEnum = z.enum(['draft', 'sent', 'approved', 'rejected'])

export const proposalCreateSchema = z.object({
  client_id: optUuid,
  lead_id: optUuid,
  value: money.nullish(),
  valid_until: dateStr.nullish(),
  notes: optText(5000),
})

export const proposalUpdateSchema = z.object({
  status: proposalStatusEnum.optional(),
  value: money.optional(),
  valid_until: dateStr.nullish(),
  notes: optText(5000),
})

export const proposalItemCreateSchema = z.object({
  service_id: optUuid,
  custom_description: optText(1000),
  price: money,
})

export const proposalItemDeleteSchema = z.object({
  item_id: uuid,
})

// ---------- Tasks ----------
export const taskStatusEnum = z.enum(['pending', 'in_progress', 'done'])
export const taskPriorityEnum = z.enum(['low', 'medium', 'high'])

export const taskCreateSchema = z.object({
  title: text(300).min(1),
  description: optText(5000),
  priority: taskPriorityEnum.optional(),
  due_date: dateStr.nullish(),
  status: taskStatusEnum.optional(),
  client_id: optUuid,
  lead_id: optUuid,
  assigned_to: optText(200),
  assigned_to_id: optUuid,
  assigned_to_ids: z.array(uuid).max(50).optional(),
  tags: z.array(text(50)).max(50).optional(),
})

export const taskUpdateSchema = taskCreateSchema.partial()

export const checklistCreateSchema = z.object({
  text: text(500).min(1),
  checklist_id: uuid,
})

export const checklistUpdateSchema = z.object({
  done: z.boolean().optional(),
  text: text(500).min(1).optional(),
})

export const taskChecklistCreateSchema = z.object({
  title: text(200).min(1).optional(),
})

export const taskChecklistUpdateSchema = z.object({
  title: text(200).min(1).optional(),
  position: z.number().int().min(0).max(10000).optional(),
})

export const commentCreateSchema = z.object({
  author: optText(200),
  body: text(5000).min(1),
})

// ---------- Workspace Docs ----------
export const docVisibilityEnum = z.enum(['personal', 'shared', 'specific'])

export const docCreateSchema = z.object({
  title: optText(300),
  visibility: docVisibilityEnum.optional(),
})

export const docUpdateSchema = z.object({
  title: text(300).optional(),
  content: z.unknown().optional(),
  visibility: docVisibilityEnum.optional(),
})

export const docSharesSchema = z.object({
  user_ids: z.array(uuid).max(200),
})

export const docPageCreateSchema = z.object({
  title: optText(300),
})

export const docPagesReorderSchema = z.object({
  order: z.array(uuid).max(500),
})

// ---------- Custom Fields ----------
export const customFieldCreateSchema = z.object({
  entity_type: z.enum(['client', 'lead']),
  name: text(200).min(1),
  field_type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'url']),
  options: z.array(text(200)).max(100).nullish(),
})

export const customFieldValuesSchema = z.object({
  entity_id: uuid,
  values: z
    .array(
      z.object({
        definition_id: uuid,
        value: z.union([z.string().max(5000), z.number(), z.boolean(), z.null()]),
      })
    )
    .max(200),
})

// ---------- Automations ----------
export const automationUpdateSchema = z.object({
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).nullish(),
})

// ---------- Automation Workflows (motor plugável) ----------
export const workflowTriggerEnum = z.enum([
  'lead.stage_changed', 'proposal.status_changed', 'client.status_changed',
])

export const workflowConditionOperatorEnum = z.enum([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains',
])

export const workflowConditionSchema = z.object({
  field: text(60).min(1),
  operator: workflowConditionOperatorEnum,
  value: text(200),
})

export const workflowActionSchema = z.object({
  type: z.enum(['create_task', 'create_notification', 'send_email', 'send_whatsapp']),
  params: z.record(z.string().max(60), text(2000)),
})

export const workflowCreateSchema = z.object({
  name: text(200).min(1),
  trigger_type: workflowTriggerEnum,
  enabled: z.boolean().optional(),
  conditions: z.array(workflowConditionSchema).max(10).optional(),
  actions: z.array(workflowActionSchema).min(1).max(10),
})

export const workflowUpdateSchema = workflowCreateSchema.partial()

// ---------- Profiles ----------
export const profileUpdateSchema = z.object({
  name: text(200).min(1).optional(),
  avatar_color: text(20).optional(),
  avatar_url: optText(1000),
  bio: optText(2000),
  birth_date: dateStr.nullish(),
  phone: optText(50),
  role: z.enum(['admin', 'member', 'user']).optional(),
})

export const inviteSchema = z.object({
  email: z.email().max(320),
  name: optText(200),
  mode: z.enum(['email', 'link']).optional(),
})

// ---------- Inbox ----------
export const inboxChannelEnum = z.enum(['whatsapp', 'instagram', 'facebook'])
export const inboxStatusEnum = z.enum(['open', 'pending', 'resolved'])

export const inboxConversationCreateSchema = z.object({
  channel: inboxChannelEnum,
  contact_name: text(200).min(1),
  contact_handle: optText(200),
  lead_id: optUuid,
  client_id: optUuid,
})

export const inboxConversationUpdateSchema = z.object({
  status: inboxStatusEnum.optional(),
  assigned_to: optUuid,
  lead_id: optUuid,
  client_id: optUuid,
  ai_enabled: z.boolean().optional(),
})

export const inboxMessageCreateSchema = z
  .object({
    direction: z.enum(['inbound', 'outbound']),
    content: optText(10000),
    attachment_r2_key: optText(600),
    attachment_name: optText(300),
    attachment_mime_type: optText(200),
    attachment_size: z.number().int().positive().nullish(),
  })
  .refine((m) => m.content || m.attachment_r2_key, {
    message: 'Mensagem precisa de conteúdo ou anexo.',
  })

// ---------- Webhook WhatsApp (UAZAPI) ----------
export const whatsappWebhookSchema = z
  .object({
    event: optText(50),
    EventType: optText(50),
    message: z
      .object({
        chatid: optText(150),
        sender: optText(150),
        senderName: optText(200),
        pushName: optText(200),
        fromMe: z.boolean().optional(),
        isGroup: z.boolean().optional(),
        type: optText(50),
        messageType: optText(50),
        text: optText(10000),
        content: optText(10000),
      })
      .loose()
      .optional(),
  })
  .loose()

// ---------- Documentos de cliente / Upload ----------
export const documentDescriptionSchema = z.object({
  description: optText(2000),
})
