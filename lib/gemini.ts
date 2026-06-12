/**
 * lib/gemini.ts
 * Cliente mínimo da API do Google Gemini (generateContent), usado pelo
 * agente SDR (lib/ai-sdr.ts) e pelo resumo de cliente (lib/ai-summary.ts).
 *
 * Variável de ambiente necessária:
 *   GEMINI_API_KEY — chave da API do Gemini (aistudio.google.com/apikey)
 *
 * Se a variável não estiver configurada, callGemini retorna null sem lançar erro.
 * Se a chamada à API falhar, lança um erro.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.5-flash'
const DEFAULT_MAX_TOKENS = 1024

export interface GeminiMessage {
  role: 'user' | 'model'
  text: string
}

export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface GeminiFunctionCall {
  name: string
  args: Record<string, unknown>
}

export interface GeminiResult {
  text: string | null
  functionCall: GeminiFunctionCall | null
}

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
}

export async function callGemini(options: {
  systemPrompt: string
  messages: GeminiMessage[]
  tools?: GeminiFunctionDeclaration[]
  maxTokens?: number
}): Promise<GeminiResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const res = await fetch(`${GEMINI_API_URL}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.systemPrompt }] },
      contents: options.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      ...(options.tools ? { tools: [{ functionDeclarations: options.tools }] } : {}),
      generationConfig: { maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS },
    }),
  })

  if (!res.ok) {
    throw new Error('Falha na chamada à API do Gemini.')
  }

  const data: GeminiResponse = await res.json()
  const parts = data.candidates?.[0]?.content?.parts ?? []

  const text = parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n')
    .trim()

  const functionCallPart = parts.find((p) => p.functionCall)

  return {
    text: text || null,
    functionCall: functionCallPart?.functionCall
      ? { name: functionCallPart.functionCall.name, args: functionCallPart.functionCall.args ?? {} }
      : null,
  }
}
