// Formatierungs-Helfer (deutsche Schreibweise).

export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value)
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(2)} %`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value)
}

export function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

export function deltaClass(value: number | null | undefined): string {
  if (value == null) return ''
  return value >= 0 ? 'up' : 'down'
}
