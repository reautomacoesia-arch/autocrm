/**
 * lib/ai-sdr.ts
 * Agente de IA (SDR virtual) que responde mensagens do WhatsApp na inbox.
 *
 * Variável de ambiente necessária:
 *   GEMINI_API_KEY — chave da API do Gemini (aistudio.google.com/apikey)
 *
 * Se a variável não estiver configurada, generateSdrReply retorna { reply: null, lead: null }
 * sem lançar erro — o webhook continua registrando a mensagem normalmente.
 */

import { callGemini, type GeminiFunctionDeclaration, type GeminiMessage } from '@/lib/gemini'

export const DEFAULT_SDR_SYSTEM_PROMPT = `Você é o assistente comercial (SDR) que atende o WhatsApp da empresa.
Seu objetivo é: entender o que o contato precisa, responder de forma simpática e objetiva,
e qualificar o interesse fazendo perguntas como nome, empresa, principal necessidade e orçamento aproximado.

Quando já tiver informações suficientes (nome e uma necessidade/contexto claro), use a ferramenta
"create_lead" para registrar esse contato como lead no CRM — faça isso apenas uma vez por conversa.

Responda sempre em português, em mensagens curtas (estilo WhatsApp), sem markdown.`

const CREATE_LEAD_TOOL: GeminiFunctionDeclaration = {
  name: 'create_lead',
  description:
    'Registra o contato como lead qualificado no CRM. Use apenas quando já souber o nome do contato e tiver entendido sua necessidade/interesse.',
  parameters: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING', description: 'Nome do contato' },
      company: { type: 'STRING', description: 'Empresa do contato, se mencionada' },
      email: { type: 'STRING', description: 'E-mail do contato, se informado' },
      estimated_value: { type: 'NUMBER', description: 'Valor estimado do negócio em reais, se houver indício' },
      notes: { type: 'STRING', description: 'Resumo da conversa: necessidade, contexto e próximos passos' },
    },
    required: ['name', 'notes'],
  },
}

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

export async function generateSdrReply(
  history: SdrHistoryMessage[],
  systemPrompt: string
): Promise<SdrResult> {
  if (history.length === 0) return { reply: null, lead: null }

  const messages: GeminiMessage[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    text: m.content,
  }))

  let result
  try {
    result = await callGemini({
      systemPrompt: systemPrompt || DEFAULT_SDR_SYSTEM_PROMPT,
      messages,
      tools: [CREATE_LEAD_TOOL],
    })
  } catch {
    return { reply: null, lead: null }
  }

  if (!result) return { reply: null, lead: null }

  let lead: SdrLeadData | null = null
  if (result.functionCall?.name === 'create_lead') {
    const args = result.functionCall.args
    if (typeof args.name === 'string' && typeof args.notes === 'string') {
      lead = {
        name: args.name,
        company: typeof args.company === 'string' ? args.company : undefined,
        email: typeof args.email === 'string' ? args.email : undefined,
        estimated_value: typeof args.estimated_value === 'number' ? args.estimated_value : undefined,
        notes: args.notes,
      }
    }
  }

  return { reply: result.text, lead }
}
