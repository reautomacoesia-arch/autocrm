'use client'
import type { Lead } from '@/lib/types'
interface Props { isOpen: boolean; onClose: () => void; onLeadAdded: (lead: Lead) => void }
export default function AddLeadModal({ isOpen }: Props) {
  if (!isOpen) return null
  return <div />
}
