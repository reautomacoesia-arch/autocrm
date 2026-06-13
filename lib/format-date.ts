/**
 * Formata uma data para pt-BR de forma segura, evitando shift de timezone
 * para strings no formato 'YYYY-MM-DD' (que o `new Date()` interpretaria
 * como UTC). Para outros formatos (ex.: timestamps ISO completos), cai
 * no parse padrão com fallback `toLocaleDateString('pt-BR')`.
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
  }
  return new Date(dateStr).toLocaleDateString('pt-BR')
}
