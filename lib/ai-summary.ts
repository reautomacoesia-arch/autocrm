/**
 * lib/ai-summary.ts
 * Gera um resumo em IA ("me atualiza") do histórico recente de um cliente:
 * interações, tarefas, propostas e conversas da inbox.
 *
 * Variável de ambiente necessária:
 *   GEMINI_API_KEY — chave da API do Gemini (aistudio.google.com/apikey)
 *
 * Se a variável não estiver configurada, generateClientSummary lança um erro
 * com mensagem amigável para ser exibida ao usuário.
 */

import { callGemini } from '@/lib/gemini'

const SYSTEM_PROMPT = `Você é um assistente que ajuda a equipe de atendimento a se atualizar rapidamente sobre um cliente.
Com base nas informações fornecidas (dados do cliente, interações recentes, tarefas, propostas e conversas),
escreva um resumo curto e objetivo em português, sem markdown (sem **, #, etc.), organizado em poucas frases ou
uma lista simples com "•". Destaque: situação geral do cliente, fatos recentes relevantes, pendências/tarefas
em aberto e uma sugestão de próximo passo. Seja direto — no máximo 8 linhas.`

export async function generateClientSummary(context: string): Promise<string> {
  const result = await callGemini({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', text: context }],
  })

  if (!result) {
    throw new Error('Resumo por IA não configurado (defina GEMINI_API_KEY).')
  }

  if (!result.text) {
    throw new Error('A IA não retornou um resumo.')
  }

  return result.text
}
