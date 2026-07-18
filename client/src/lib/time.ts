// Zeit- und Formatierungs-Helfer.

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk'

/** Tageszeit-Phase – steuert das "Dawn Horizon"-Signature-Band. */
export function dayPhase(date: Date): DayPhase {
  const h = date.getHours()
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 18) return 'day'
  if (h >= 18 && h < 21) return 'dusk'
  return 'night'
}

export function greeting(date: Date): string {
  const h = date.getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
}

/** Ganze Tage von heute (00:00) bis zum Zieldatum – für Countdowns. */
export function daysUntil(iso: string, from: Date = new Date()): number {
  const target = new Date(iso)
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** "heute" / "morgen" / "in X Tagen". */
export function countdownLabel(iso: string): string {
  const d = daysUntil(iso)
  if (d < 0) return 'vorbei'
  if (d === 0) return 'heute'
  if (d === 1) return 'morgen'
  return `in ${d} Tagen`
}

export function relativeTime(iso: string, from: Date = new Date()): string {
  const diffMin = Math.round((from.getTime() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `vor ${diffH} h`
  const diffD = Math.round(diffH / 24)
  return `vor ${diffD} d`
}
