import { z } from 'zod'

export const MAX_UPLOAD_SIZE = 500 * 1024 * 1024 // 500 MB

/**
 * Tipos de arquivo aceitos para upload (documentos de cliente e anexos da inbox).
 * Bloqueia executáveis, scripts e tipos que não fazem sentido num CRM.
 */
export const ALLOWED_MIME_TYPES = new Set([
  // Imagens
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/heic', 'image/heif',
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown',
  'application/json',
  // Compactados
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/gzip',
  // Áudio (mensagens de voz do WhatsApp etc.)
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/opus',
  // Vídeo
  'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp',
])

export const presignSchema = z.object({
  name: z.string().min(1).max(300),
  size: z.number().int().positive().max(MAX_UPLOAD_SIZE),
  mime_type: z.string().max(200),
})

export const documentConfirmSchema = presignSchema.extend({
  r2_key: z.string().min(1).max(600),
})

export function isAllowedMimeType(mime: string): boolean {
  return ALLOWED_MIME_TYPES.has(mime.toLowerCase().split(';')[0].trim())
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}
