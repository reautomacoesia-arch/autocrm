/**
 * lib/uazapi.ts
 * Cliente mínimo da UAZAPI (uazapi.com) para envio de mensagens de WhatsApp.
 *
 * Variáveis de ambiente necessárias:
 *   UAZAPI_URL    — URL do servidor da instância (ex.: https://sua-instancia.uazapi.com)
 *   UAZAPI_TOKEN  — token da instância (header "token")
 *
 * Se as variáveis não estiverem configuradas, as funções não fazem nada
 * (retornam false) — útil para dev local sem WhatsApp conectado.
 */

function uazapiConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.UAZAPI_URL
  const token = process.env.UAZAPI_TOKEN
  if (!baseUrl || !token) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), token }
}

export async function sendWhatsAppText(phone: string, message: string): Promise<boolean> {
  const config = uazapiConfig()
  if (!config) return false

  const res = await fetch(`${config.baseUrl}/send/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      token: config.token,
    },
    body: JSON.stringify({ number: phone, text: message }),
  })

  return res.ok
}
