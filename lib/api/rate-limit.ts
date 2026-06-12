import { NextResponse } from 'next/server'

/**
 * Rate limiting por janela deslizante, em memória.
 *
 * Limitação conhecida: em ambiente serverless (Vercel) cada instância tem o
 * próprio Map, então o limite efetivo pode ser maior que o configurado sob
 * múltiplas instâncias. Para uso interno é proteção suficiente contra flood
 * e brute force; se o app virar SaaS, trocar por Upstash Ratelimit/Redis.
 */
const buckets = new Map<string, number[]>()

const MAX_BUCKETS = 10_000

function sweep(now: number, windowMs: number) {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || now - hits[hits.length - 1] > windowMs) {
      buckets.delete(key)
    }
  }
}

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  sweep(now, windowMs)

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return true
  }
  hits.push(now)
  buckets.set(key, hits)
  return false
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : 'unknown'
}

/**
 * Aplica rate limit por IP + nome da rota.
 * Retorna uma resposta 429 se o limite foi excedido, ou null para seguir.
 */
export function rateLimit(
  request: Request,
  name: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): NextResponse | null {
  if (isRateLimited(`${name}:${clientIp(request)}`, limit, windowMs)) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } }
    )
  }
  return null
}
