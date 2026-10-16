import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { prefersReducedMotion, easeOutExpo } from '../lib/motion.ts'

// ===========================================================================
// Tagesregler – der Tag von 06:00 bis 03:00 als Leiste zum Ziehen.
// Blöcke kommen aus dem Tagesplan (/api/dayplan): Morgen, Unterricht,
// Entfall, Termine, Gym, Lernen, freie Zeit, Schlaf. Heute ist der
// vergangene Teil schraffiert; an anderen Tagen startet der Regler beim
// Aufstehen.
// ===========================================================================

export type RulerKind =
  | 'school' | 'break' | 'free' | 'sleep' | 'morning' | 'commute'
  | 'cancelled' | 'gym' | 'event' | 'work' | 'study'

export interface RulerBlock {
  start: number // Minuten ab Mitternacht (nach Mitternacht > 1440)
  end: number
  name: string
  kind: RulerKind
  info: string
  clash?: boolean
}

// Liegen Blöcke übereinander (Termin in der Schulzeit, Entfall in freier
// Zeit), gewinnt beim Ziehen der wichtigere.
const RANK: Record<RulerKind, number> = {
  event: 6, gym: 6, work: 6, study: 5, school: 4, cancelled: 3, morning: 2, commute: 2, break: 1, free: 0, sleep: 0
}

const START = 6 * 60
const SPAN = 21 * 60 // 06:00 bis 03:00
const pad = (n: number) => String(n).padStart(2, '0')
/** Minuten seit 06:00, auf die Leiste begrenzt. */
const T = (min: number) => Math.max(0, Math.min(SPAN, min - START))
const fmt = (m: number) => {
  const v = (Math.round(m) + START) % 1440
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`
}
const nowMin = () => {
  const d = new Date()
  let m = d.getHours() * 60 + d.getMinutes()
  if (m < 3 * 60) m += 1440 // bis 03:00 zählt noch zum Vortag
  return T(m)
}

export default function DayRuler({
  blocks,
  bedtime,
  isToday,
  startAt,
  homeRef
}: {
  blocks: RulerBlock[]
  bedtime: number | null
  isToday: boolean
  /** Wohin der Regler an anderen Tagen gleitet (Minuten ab Mitternacht). */
  startAt: number
  /** Von außen „zurück zu jetzt/zum Aufstehen“ auslösen. */
  homeRef?: MutableRefObject<(() => void) | null>
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [cur, setCur] = useState(0)
  const curRef = useRef(0)
  const anim = useRef(0)
  const dragging = useRef(false)

  const set = (m: number) => {
    curRef.current = m
    setCur(m)
  }
  const glideTo = useCallback((target: number) => {
    cancelAnimationFrame(anim.current)
    if (prefersReducedMotion()) return set(target)
    const from = curRef.current
    const st = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - st) / 700)
      set(from + (target - from) * easeOutExpo(t))
      if (t < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }, [])

  const home = useCallback(() => (isToday ? nowMin() : T(startAt)), [isToday, startAt])
  if (homeRef) homeRef.current = () => glideTo(home())

  // Beim Erscheinen (und beim Tageswechsel) zur aktuellen Uhrzeit bzw. zum
  // Aufstehen gleiten
  useEffect(() => {
    const t = setTimeout(() => glideTo(home()), curRef.current ? 0 : 700)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(anim.current)
    }
  }, [glideTo, home])

  const visible = blocks.filter((b) => T(b.end) > T(b.start))
  const hit = visible.reduce(
    (best, b, i) => (cur >= T(b.start) && cur < T(b.end) && (best < 0 || RANK[b.kind] > RANK[visible[best].kind]) ? i : best),
    -1
  )
  const text = useMemo(() => {
    if (hit >= 0) {
      const b = visible[hit]
      if (b.kind === 'free' && b.name === 'Frei' && bedtime) {
        const left = Math.round(T(bedtime) - cur)
        return `Frei · noch ${Math.floor(left / 60)}h ${pad(left % 60)} bis Schlafenszeit`
      }
      return b.info ? `${b.name} · ${b.info}` : b.name
    }
    return 'Frei'
  }, [hit, visible, bedtime, cur])

  const fromEvent = (e: React.PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(SPAN, ((e.clientX - r.left) / r.width) * SPAN))
  }
  const p = (cur / SPAN) * 100

  return (
    <div className="dr" aria-label="Tagesregler">
      <div
        className="dr-ruler"
        role="slider"
        tabIndex={0}
        aria-label="Uhrzeit wählen"
        aria-valuemin={0}
        aria-valuemax={SPAN}
        aria-valuenow={Math.round(cur)}
        aria-valuetext={`${fmt(cur)} ${text}`}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          glideTo(fromEvent(e))
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return
          cancelAnimationFrame(anim.current)
          set(fromEvent(e))
        }}
        onPointerUp={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') set(Math.min(SPAN, curRef.current + 15))
          else if (e.key === 'ArrowLeft') set(Math.max(0, curRef.current - 15))
          else return
          e.preventDefault()
        }}
      >
        <div className="dr-readout" style={{ left: `clamp(90px, ${p}%, calc(100% - 140px))` }}>
          <b>{fmt(cur)}</b>
          <span>{text}</span>
        </div>
        <div className="dr-track" ref={trackRef}>
          {isToday && <div className="dr-past" style={{ width: `${(nowMin() / SPAN) * 100}%` }} />}
          {visible.map((b, i) => (
            <div
              key={`${b.start}-${b.kind}-${b.name}`}
              className={`dr-blk is-${b.kind} ${b.clash ? 'is-clash' : ''} ${i === hit ? 'is-hit' : ''}`}
              title={`${b.name} · ${fmt(T(b.start))}–${fmt(T(b.end))}`}
              style={{
                left: `calc(${(T(b.start) / SPAN) * 100}% + 2px)`,
                width: `calc(${((T(b.end) - T(b.start)) / SPAN) * 100}% - 4px)`
              }}
            >
              {b.name}
            </div>
          ))}
        </div>
        <div className="dr-knob" style={{ left: `${p}%` }} />
        <div className="dr-ticks" aria-hidden>
          {[6, 9, 12, 15, 18, 21, 24, 27].map((h) => (
            <span key={h} style={{ left: `${(T(h * 60) / SPAN) * 100}%` }}>
              {pad(h % 24)}:00
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
