import { describe, it, expect } from 'vitest'
import { parseBody } from '@/lib/api/validation'
import {
  leadCreateSchema,
  leadUpdateSchema,
  clientCreateSchema,
  transactionCreateSchema,
  taskCreateSchema,
  inviteSchema,
  inboxMessageCreateSchema,
  profileUpdateSchema,
} from '@/lib/api/schemas'
import { presignSchema, isAllowedMimeType, sanitizeFileName } from '@/lib/api/upload'
import { isRateLimited } from '@/lib/api/rate-limit'

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('parseBody', () => {
  it('aceita payload válido', async () => {
    const result = await parseBody(jsonRequest({ name: 'João' }), leadCreateSchema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.name).toBe('João')
  })

  it('rejeita payload sem campo obrigatório com 400', async () => {
    const result = await parseBody(jsonRequest({ company: 'ACME' }), leadCreateSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it('rejeita JSON malformado com 400', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: '{not json',
    })
    const result = await parseBody(req, leadCreateSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it('remove campos desconhecidos (mass assignment)', async () => {
    const result = await parseBody(
      jsonRequest({ name: 'João', is_internal: true, evil_field: 'x' }),
      leadCreateSchema
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('evil_field' in result.data).toBe(false)
      expect('is_internal' in result.data).toBe(false)
    }
  })

  it('rejeita tipos errados', async () => {
    const result = await parseBody(
      jsonRequest({ name: 'João', estimated_value: 'mil reais' }),
      leadCreateSchema
    )
    expect(result.ok).toBe(false)
  })
})

describe('schemas', () => {
  it('lead: rejeita stage inválido', () => {
    expect(leadUpdateSchema.safeParse({ stage: 'hacked' }).success).toBe(false)
    expect(leadUpdateSchema.safeParse({ stage: 'won' }).success).toBe(true)
  })

  it('client: rejeita status fora do enum', () => {
    expect(clientCreateSchema.safeParse({ name: 'X', status: 'deleted' }).success).toBe(false)
  })

  it('transaction: exige client_id uuid', () => {
    expect(
      transactionCreateSchema.safeParse({
        client_id: 'not-a-uuid', amount: 100, type: 'received', date: '2026-06-11',
      }).success
    ).toBe(false)
    expect(
      transactionCreateSchema.safeParse({
        client_id: 'a3bb189e-8bf9-3888-9912-ace4e6543002', amount: 100, type: 'received', date: '2026-06-11',
      }).success
    ).toBe(true)
  })

  it('task: limita arrays de assignees e tags', () => {
    const ids = Array.from({ length: 51 }, () => 'a3bb189e-8bf9-3888-9912-ace4e6543002')
    expect(taskCreateSchema.safeParse({ title: 'T', assigned_to_ids: ids }).success).toBe(false)
  })

  it('invite: rejeita e-mail inválido', () => {
    expect(inviteSchema.safeParse({ email: 'naoeemail' }).success).toBe(false)
    expect(inviteSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
  })

  it('inbox message: exige conteúdo ou anexo', () => {
    expect(inboxMessageCreateSchema.safeParse({ direction: 'outbound' }).success).toBe(false)
    expect(
      inboxMessageCreateSchema.safeParse({ direction: 'outbound', content: 'oi' }).success
    ).toBe(true)
  })

  it('profile: rejeita role fora do enum', () => {
    expect(profileUpdateSchema.safeParse({ role: 'superadmin' }).success).toBe(false)
  })
})

describe('upload', () => {
  it('bloqueia MIME types perigosos', () => {
    expect(isAllowedMimeType('application/x-msdownload')).toBe(false)
    expect(isAllowedMimeType('text/html')).toBe(false)
    expect(isAllowedMimeType('application/pdf')).toBe(true)
    expect(isAllowedMimeType('IMAGE/PNG')).toBe(true)
  })

  it('rejeita tamanho acima do limite', () => {
    expect(
      presignSchema.safeParse({ name: 'a.pdf', size: 600 * 1024 * 1024, mime_type: 'application/pdf' }).success
    ).toBe(false)
  })

  it('sanitiza nomes de arquivo', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('.._.._etc_passwd')
    expect(sanitizeFileName('relatório final.pdf')).toBe('relat_rio_final.pdf')
  })
})

describe('rate limit', () => {
  it('bloqueia após exceder o limite na janela', () => {
    const key = `test-${Date.now()}`
    expect(isRateLimited(key, 3, 60_000)).toBe(false)
    expect(isRateLimited(key, 3, 60_000)).toBe(false)
    expect(isRateLimited(key, 3, 60_000)).toBe(false)
    expect(isRateLimited(key, 3, 60_000)).toBe(true)
  })
})
