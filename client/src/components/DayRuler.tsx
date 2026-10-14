import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { prefersReducedMotion, easeOutExpo } from '../lib/motion.ts'

// ===========================================================================
// Tagesregler – der Tag von 06:00 bis 03:00 als Leiste zum Ziehen.
// Blöcke: Unterricht (aus dem Stundenplan), freie Zeit bis zur Schlafenszeit
// (aus dem Schlaf-Coaching), Schlaf. Der vergangene Teil ist schraffiert.
// ===========================================================================

export interface RulerBlock {
  start: string // HH:MM
  end: string
  name: string
  kind: 'school' | 'free' | 'sleep'
  info: string
}

const START = 6 * 60
const SPAN = 21 * 60 // 06:00 bis 03:00
const pad = (n: number) => String(n).padStart(2, '0')
/** Minuten seit 06:00; Zeiten nach Mitternacht zählen zum selben Tag. */
const T = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  let v = h * 60 + m
  if (v < START) v += 1440
  return v - START
}
const fmt = (m: number) => {
  const v = (Math.round(m) + START) % 1440
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`
}
const nowMin = () => {
  const d = new Date()
  return Math.max(0, Math.min(SPAN, T(`${pad(d.getHours())}:${pad(d.getMinutes())}`)))
}

export default function DayRuler({ title, blocks, bedtime }: { title: string; blocks: RulerBlock[]; bedtime: string | null }) {
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

  // Beim Erscheinen von 06:00 zur aktuellen Uhrzeit gleiten
  useEffect(() => {
    const t = setTimeout(() => glideTo(nowMin()), 700)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(anim.current)
    }
  }, [glideTo])

  const hit = blocks.findIndex((b) => cur >= T(b.start) && cur < T(b.end))
  const text = useMemo(() => {
    if (hit >= 0) {
      const b = blocks[hit]
      if (b.kind === 'free' && bedtime) {
        const left = Math.round(T(bedtime) - cur)
        return `Frei · noch ${Math.floor(left / 60)}h ${pad(left % 60)} bis Schlafenszeit`
      }
      return `${b.name} · ${b.info}`
    }
    const firstSchool = blocks.find((b) => b.kind === 'school')
    if (firstSchool && cur < T(firstSchool.start)) return 'Vor der Schule'
    if (blocks.some((b) => b.kind === 'school' && T(b.start) > cur)) return 'Pause'
    return 'Frei'
  }, [hit, blocks, bedtime, cur])

  const fromEvent = (e: React.PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(SPAN, ((e.clientX - r.left) / r.width) * SPAN))
  }
  const p = (cur / SPAN) * 100

  return (
    <section className="dr" aria-label="Tagesregler">
      <div className="dr-head">
        <h2 className="dr-title">{title}</h2>
        <button className="dr-now" onClick={() => glideTo(nowMin())}>
          Zurück zu jetzt
        </button>
      </div>
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
          <div className="dr-past" style={{ width: `${(nowMin() / SPAN) * 100}%` }} />
          {blocks.map((b, i) => (
            <div
              key={`${b.start}-${b.name}`}
              className={`dr-blk is-${b.kind} ${i === hit ? 'is-hit' : ''}`}
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
          {[6, 9, 12, 15, 18, 21, 0, 3].map((h) => (
            <span key={h} style={{ left: `${(T(`${pad(h)}:00`) / SPAN) * 100}%` }}>
              {pad(h)}:00
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
