/**
 * lib/ai-summary.ts
 * Gera um resumo em IA ("me atualiza") do histórico recente de um cliente:
 * interações, tarefas, propostas e conversas da inbox.
 *
 * Variável de ambiente necessária:
 *   ANTHROPIC_API_KEY — chave da API da Anthropic (console.anthropic.com)
 *
 * Se a variável não estiver configurada, generateClientSummary lança um erro
 * com mensagem amigável para ser exibida ao usuário.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1024

const SYSTEM_PROMPT = `Você é um assistente que ajuda a equipe de atendimento a se atualizar rapidamente sobre um cliente.
Com base nas informações fornecidas (dados do cliente, interações recentes, tarefas, propostas e conversas),
escreva um resumo curto e objetivo em português, sem markdown (sem **, #, etc.), organizado em poucas frases ou
uma lista simples com "•". Destaque: situação geral do cliente, fatos recentes relevantes, pendências/tarefas
em aberto e uma sugestão de próximo passo. Seja direto — no máximo 8 linhas.`

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  error?: { message: string }
}

export async function generateClientSummary(context: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Resumo por IA não configurado (defina ANTHROPIC_API_KEY).')
  }

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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    }),
  })

  if (!res.ok) {
    throw new Error('Falha ao gerar resumo com IA.')
  }

  const data: AnthropicResponse = await res.json()
  const summary = (data.content ?? [])
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n')
    .trim()

  if (!summary) {
    throw new Error('A IA não retornou um resumo.')
  }

  return summary
}
