import { describe, it, expect } from 'vitest'
import { STAGES, STAGE_LABELS } from '@/lib/pipeline'
import type { LeadStage } from '@/lib/types'

describe('Pipeline constants', () => {
  it('STAGES contém todas as 6 etapas na ordem correta', () => {
    expect(STAGES).toHaveLength(6)
    expect(STAGES[0]).toBe('lead')
    expect(STAGES[4]).toBe('won')
    expect(STAGES[5]).toBe('lost')
  })

  it('STAGE_LABELS tem label para cada etapa', () => {
    const allStages: LeadStage[] = ['lead', 'contacted', 'proposal_sent', 'negotiating', 'won', 'lost']
    allStages.forEach((stage) => {
      expect(STAGE_LABELS[stage]).toBeDefined()
      expect(typeof STAGE_LABELS[stage]).toBe('string')
    })
  })
})
