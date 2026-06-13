/**
 * lib/ai-lead-score.ts
 * Pontua a "temperatura" de um lead (0-100) via IA, com base em estágio do
 * pipeline, valor estimado, engajamento/recência das interações, clareza do
 * próximo passo e qualidade das notas.
 *
 * Variável de ambiente necessária:
 *   GEMINI_API_KEY — chave da API do Gemini (aistudio.google.com/apikey)
 *
 * Se a variável não estiver configurada, scoreLead lança um erro com
 * mensagem amigável para ser exibida ao usuário.
 */

import { callGemini } from '@/lib/gemini'

const SYSTEM_PROMPT = `Você é um analista de SDR (pré-vendas) que avalia a TEMPERATURA de um lead,
ou seja, a probabilidade de ele fechar negócio em breve. Considere: o estágio dele no pipeline,
o valor estimado, o engajamento e a recência das interações/mensagens, a clareza do próximo passo
definido e a qualidade das notas registradas. Atribua uma nota de 0 a 100 (0 = totalmente gelado,
sem chance de avançar; 100 = extremamente quente, prestes a fechar).
Responda ESTRITAMENTE em JSON válido, sem markdown e sem texto extra, no formato exato:
{"score": <inteiro de 0 a 100>, "reasoning": "<motivo curto em português, até 140 caracteres>"}`

export interface LeadScoreResult {
  score: number
  reasoning: string
}

function parseScoreResponse(text: string): LeadScoreResult {
  const match = text.match(/\{[\s\S]*\}/)
  const jsonText = match ? match[0] : text

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('A IA retornou um formato inválido.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('A IA retornou um formato inválido.')
  }

  const obj = parsed as Record<string, unknown>
  const rawScore = typeof obj.score === 'number' ? obj.score : Number(obj.score)
  const score = Number.isFinite(rawScore)
    ? Math.min(100, Math.max(0, Math.round(rawScore)))
    : 0
  const reasoning = typeof obj.reasoning === 'string' ? obj.reasoning : ''

  return { score, reasoning }
}

export async function scoreLead(context: string): Promise<LeadScoreResult> {
  const result = await callGemini({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', text: context }],
  })

  if (!result) {
    throw new Error('Lead scoring não configurado (defina GEMINI_API_KEY).')
  }

  if (!result.text) {
    throw new Error('A IA não retornou um score.')
  }

  return parseScoreResponse(result.text)
}
