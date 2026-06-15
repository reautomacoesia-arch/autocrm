// Formata o tempo entre duas datas ISO de forma legível (ex.: "2h", "3d 4h", "5min")
export function formatDuration(fromISO: string, toISO: string): string {
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime()
  if (ms <= 0) return '0min'

  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const remMinutes = minutes % 60
    return remMinutes > 0 ? `${hours}h ${remMinutes}min` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`
}
