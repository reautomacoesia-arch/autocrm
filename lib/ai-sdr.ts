/**
 * lib/ai-sdr.ts
 * Agente de IA (SDR virtual) que responde mensagens do WhatsApp na inbox.
 *
 * Variável de ambiente necessária:
 *   ANTHROPIC_API_KEY — chave da API da Anthropic (console.anthropic.com)
 *
 * Se a variável não estiver configurada, generateSdrReply retorna { reply: null, lead: null }
 * sem lançar erro — o webhook continua registrando a mensagem normalmente.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

export const DEFAULT_SDR_SYSTEM_PROMPT = `Você é o assistente comercial (SDR) que atende o WhatsApp da empresa.
Seu objetivo é: entender o que o contato precisa, responder de forma simpática e objetiva,
e qualificar o interesse fazendo perguntas como nome, empresa, principal necessidade e orçamento aproximado.

Quando já tiver informações suficientes (nome e uma necessidade/contexto claro), use a ferramenta
"create_lead" para registrar esse contato como lead no CRM — faça isso apenas uma vez por conversa.

Responda sempre em português, em mensagens curtas (estilo WhatsApp), sem markdown.`

const CREATE_LEAD_TOOL = {
  name: 'create_lead',
  description:
    'Registra o contato como lead qualificado no CRM. Use apenas quando já souber o nome do contato e tiver entendido sua necessidade/interesse.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome do contato' },
      company: { type: 'string', description: 'Empresa do contato, se mencionada' },
      email: { type: 'string', description: 'E-mail do contato, se informado' },
      estimated_value: { type: 'number', description: 'Valor estimado do negócio em reais, se houver indício' },
      notes: { type: 'string', description: 'Resumo da conversa: necessidade, contexto e próximos passos' },
    },
    required: ['name', 'notes'],
  },
} as const

export interface SdrHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SdrLeadData {
  name: string
  company?: string
  email?: string
  estimated_value?: number
  notes: string
}

export interface SdrResult {
  reply: string | null
  lead: SdrLeadData | null
}

interface AnthropicContentBlock {
  type: string
  text?: string
  name?: string
  input?: Record<string, unknown>
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { message: string }
}

export async function generateSdrReply(
  history: SdrHistoryMessage[],
  systemPrompt: string
): Promise<SdrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || history.length === 0) return { reply: null, lead: null }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt || DEFAULT_SDR_SYSTEM_PROMPT,
      messages: history,
      tools: [CREATE_LEAD_TOOL],
    }),
  })

  if (!res.ok) return { reply: null, lead: null }

  const data: AnthropicResponse = await res.json()
  const blocks = data.content ?? []

  const reply = blocks
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n')
    .trim()

  const toolUse = blocks.find((b) => b.type === 'tool_use' && b.name === 'create_lead')
  let lead: SdrLeadData | null = null
  if (toolUse?.input && typeof toolUse.input.name === 'string' && typeof toolUse.input.notes === 'string') {
    lead = {
      name: toolUse.input.name,
      company: typeof toolUse.input.company === 'string' ? toolUse.input.company : undefined,
      email: typeof toolUse.input.email === 'string' ? toolUse.input.email : undefined,
      estimated_value: typeof toolUse.input.estimated_value === 'number' ? toolUse.input.estimated_value : undefined,
      notes: toolUse.input.notes,
    }
  }

  return { reply: reply || null, lead }
}
