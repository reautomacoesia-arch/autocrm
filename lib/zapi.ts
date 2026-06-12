/**
 * lib/zapi.ts
 * Cliente mínimo da Z-API (z-api.io) para envio de mensagens de WhatsApp.
 *
 * Variáveis de ambiente necessárias:
 *   ZAPI_INSTANCE_ID    — ID da instância Z-API
 *   ZAPI_TOKEN          — token da instância
 *   ZAPI_CLIENT_TOKEN   — token de segurança da conta (header Client-Token)
 *
 * Se as variáveis não estiverem configuradas, as funções não fazem nada
 * (retornam false) — útil para dev local sem WhatsApp conectado.
 */

const ZAPI_BASE_URL = 'https://api.z-api.io'

function zapiConfig(): { instanceId: string; token: string; clientToken: string } | null {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN
  if (!instanceId || !token || !clientToken) return null
  return { instanceId, token, clientToken }
}

export async function sendWhatsAppText(phone: string, message: string): Promise<boolean> {
  const config = zapiConfig()
  if (!config) return false

  const res = await fetch(
    `${ZAPI_BASE_URL}/instances/${config.instanceId}/token/${config.token}/send-text`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.clientToken,
      },
      body: JSON.stringify({ phone, message }),
    }
  )

  return res.ok
}
