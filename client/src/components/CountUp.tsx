import { useCountUp } from '../lib/motion.ts'

const plain = (v: number) => Math.round(v).toLocaleString('de-DE')

// Zahl, die beim Erscheinen hochzählt und bei neuen Werten weich hinübergleitet.
// `format` bekommt Zwischenwerte – es muss also mit krummen Zahlen umgehen
// (alle Formatierer im Dashboard runden ohnehin selbst).
export default function CountUp({
  value,
  format = plain,
  fallback = '–',
  duration
}: {
  value: number | null | undefined
  format?: (v: number) => string
  fallback?: string
  duration?: number
}) {
  const shown = useCountUp(value, duration)
  return <span className="count">{shown == null ? fallback : format(shown)}</span>
}
