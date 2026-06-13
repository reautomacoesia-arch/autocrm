import type { SupabaseClient } from '@supabase/supabase-js'
import type { InboxConversation } from '@/lib/types'

type EntityType = 'lead' | 'client'

interface OpenResult {
  conversation?: InboxConversation
  created?: boolean
  error?: 'not_found' | string
}

/**
 * Abre (ou cria) a conversa de WhatsApp do inbox para um lead ou cliente.
 * Busca: 1) pela FK (lead_id/client_id); 2) pelo telefone (contact_handle
 * terminando nos últimos 8 dígitos, p/ tolerar código de país) — vinculando a
 * entidade se a conversa achada não estiver vinculada; 3) cria se não existir.
 */
export async function openConversationForEntity(
  supabase: SupabaseClient,
  entity: { type: EntityType; id: string }
): Promise<OpenResult> {
  const table = entity.type === 'lead' ? 'leads' : 'clients'
  const fkCol = entity.type === 'lead' ? 'lead_id' : 'client_id'

  const { data: ent } = await supabase
    .from(table)
    .select('id, name, phone')
    .eq('id', entity.id)
    .single()
  if (!ent) return { error: 'not_found' }

  const digits = (ent.phone ?? '').replace(/\D/g, '')

  // 1. conversa já vinculada à entidade
  const { data: byFk } = await supabase
    .from('inbox_conversations')
    .select('*')
    .eq('channel', 'whatsapp')
    .eq(fkCol, entity.id)
    .limit(1)
    .maybeSingle()
  if (byFk) return { conversation: byFk as InboxConversation }

  // 2. conversa existente pelo telefone (tolera código de país)
  if (digits.length >= 8) {
    const tail = digits.slice(-8)
    const { data: byPhone } = await supabase
      .from('inbox_conversations')
      .select('*')
      .eq('channel', 'whatsapp')
      .ilike('contact_handle', `%${tail}`)
      .limit(1)
    const existing = byPhone?.[0] as InboxConversation | undefined
    if (existing) {
      if (!existing[fkCol as 'lead_id' | 'client_id']) {
        await supabase.from('inbox_conversations').update({ [fkCol]: entity.id }).eq('id', existing.id)
        existing[fkCol as 'lead_id' | 'client_id'] = entity.id
      }
      return { conversation: existing }
    }
  }

  // 3. cria a conversa vinculada à entidade
  const { data: created, error } = await supabase
    .from('inbox_conversations')
    .insert({
      channel: 'whatsapp',
      contact_name: ent.name,
      contact_handle: digits || null,
      [fkCol]: entity.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { conversation: created as InboxConversation, created: true }
}
