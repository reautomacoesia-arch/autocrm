import { describe, it, expect } from 'vitest'
import {
  CHANNEL_LABELS,
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  timeAgo,
  formatFileSize,
} from '@/lib/inbox'

describe('CHANNEL_LABELS', () => {
  it('mapeia os canais para labels em português', () => {
    expect(CHANNEL_LABELS.whatsapp).toBe('WhatsApp')
    expect(CHANNEL_LABELS.instagram).toBe('Instagram')
    expect(CHANNEL_LABELS.facebook).toBe('Facebook')
  })
})

describe('STATUS_LABELS e STATUS_BADGE_VARIANT', () => {
  it('mapeia os status para labels e variantes de badge', () => {
    expect(STATUS_LABELS.open).toBe('Aberta')
    expect(STATUS_LABELS.pending).toBe('Pendente')
    expect(STATUS_LABELS.resolved).toBe('Resolvida')
    expect(STATUS_BADGE_VARIANT.open).toBe('green')
    expect(STATUS_BADGE_VARIANT.pending).toBe('yellow')
    expect(STATUS_BADGE_VARIANT.resolved).toBe('gray')
  })
})

describe('timeAgo', () => {
  it('retorna "agora" para datas muito recentes', () => {
    const now = new Date().toISOString()
    expect(timeAgo(now)).toBe('agora')
  })

  it('retorna minutos para datas há poucos minutos', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(timeAgo(fiveMinAgo)).toBe('há 5min')
  })
})

describe('formatFileSize', () => {
  it('formata bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formata kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB')
  })

  it('formata megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('formata gigabytes', () => {
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })
})
