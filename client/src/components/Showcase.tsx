import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { paintFor } from '../lib/paint.ts'
import { useMediaQuery } from '../lib/useMediaQuery.ts'
import { prefersReducedMotion } from '../lib/motion.ts'

// ===========================================================================
// Showcase – Bereiche links, gestapelte Screens rechts (Prinzip OpenDesign).
// ---------------------------------------------------------------------------
// Der Abschnitt ist hoch, die Bühne bleibt beim Scrollen stehen (sticky). Der
// Scrollweg wird in Stufen umgerechnet: jede Stufe legt eine Karte oben auf
// den Stapel. Ältere Karten rücken nach hinten (kleiner, höher, dunkler) und
// bleiben liegen – auch über die Bereiche hinweg. Kein Timer.
//
// Pro Scroll-Frame wird nur per Ref in die Styles geschrieben, React rendert
// nur, wenn der aktive Bereich wechselt.
// ===========================================================================

export interface ShowcaseCard {
  key: string
  dark?: boolean
  /** Desktop-Position in % der Bühne: links, oben, Breite. */
  pos: [number, number, number]
  content: ReactNode
}
export interface ShowcaseArea {
  id: string
  name: string
  openLabel: string
  /** Farbe des weichen Scheins hinter dem Stapel, solange der Bereich aktiv ist. */
  glow: string
  onOpen: () => void
  cards: ShowcaseCard[]
}

const STICKY_TOP = 12
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export default function Showcase({
  title,
  areas,
  jumpRef
}: {
  title: string
  areas: ShowcaseArea[]
  /** Wird mit einer Funktion belegt, die zum Bereich Nr. k scrollt. */
  jumpRef?: MutableRefObject<((k: number) => void) | null>
}) {
  const narrow = useMediaQuery('(max-width: 760px)')
  const sectionRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const cardEls = useRef<(HTMLDivElement | null)[]>([])
  const painted = useRef<Set<number>>(new Set())
  const [active, setActive] = useState(0)
  const [count, setCount] = useState(1)
  const [labelSwap, setLabelSwap] = useState(false)
  const [label, setLabel] = useState(areas[0]?.openLabel ?? '')

  const flat = useMemo(
    () => areas.flatMap((a, k) => a.cards.map((c, j) => ({ ...c, k, j, area: a.id }))),
    [areas]
  )
  const N = flat.length
  const firstOf = useMemo(() => areas.map((_, k) => flat.findIndex((c) => c.k === k)), [areas, flat])

  const step = useCallback(() => (narrow ? 0.42 : 0.5) * window.innerHeight, [narrow])

  // ---- Höhe: einmal messen, was die Karten brauchen, und die Bühne fest so
  // hoch machen. Passt das nicht auf den Bildschirm, wird der Stapel als
  // Ganzes verkleinert statt abgeschnitten.
  const fit = useCallback(() => {
    const stage = stageRef.current
    const host = hostRef.current
    const sticky = stickyRef.current
    const section = sectionRef.current
    if (!stage || !host || !sticky || !section) return
    section.style.height = `calc(${N - 1} * ${step()}px + 100svh + 120px)`
    const els = cardEls.current.filter(Boolean) as HTMLDivElement[]
    if (!els.length) return
    let need: number
    if (narrow) {
      els.forEach((el) => (el.style.height = ''))
      const h = Math.max(...els.map((el) => el.offsetHeight))
      els.forEach((el) => (el.style.height = `${h}px`))
      need = h + 36 + 70 // Platz für die oben herausschauenden Karten
    } else {
      els.forEach((el) => (el.style.height = ''))
      need = Math.max(...els.map((el) => el.offsetTop + el.offsetHeight)) + 70
      need = Math.max(need, stage.offsetWidth / 1.6)
    }
    const head =
      (sticky.querySelector('.sx-title') as HTMLElement | null)?.offsetHeight ?? 0
    const avail = Math.max(260, sticky.clientHeight - head - (narrow ? 150 : 90))
    const scale = Math.min(1, avail / need)
    stage.style.height = `${Math.round(need * scale)}px`
    host.style.transform = scale < 1 ? `scale(${scale})` : ''
    host.style.width = scale < 1 ? `${100 / scale}%` : ''
    host.style.left = scale < 1 ? `${(100 - 100 / scale) / 2}%` : ''
  }, [N, narrow, step])

  const placePill = useCallback((k: number, instant = false) => {
    const pill = pillRef.current
    const btn = listRef.current?.querySelectorAll<HTMLButtonElement>('.sx-cat')[k]
    if (!pill || !btn) return
    if (instant) pill.style.transition = 'none'
    pill.style.width = `${btn.offsetWidth}px`
    pill.style.height = `${btn.offsetHeight}px`
    // offsetParent des Buttons ist die Liste (position: relative).
    pill.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`
    if (instant) requestAnimationFrame(() => (pill.style.transition = ''))
  }, [])

  // ---- Pro Frame: Fortschritt aus der Scrollposition → Stapel zeichnen
  const activeRef = useRef(0)
  const render = useCallback(() => {
    const section = sectionRef.current
    if (!section) return
    const range = (N - 1) * step()
    const top = section.getBoundingClientRect().top - STICKY_TOP
    let progress = clamp(-top / range, 0, 1) * (N - 1)
    if (prefersReducedMotion()) progress = Math.round(progress)

    flat.forEach((c, i) => {
      const el = cardEls.current[i]
      if (!el) return
      const reveal = i === 0 ? 1 : clamp(progress - i + 1, 0, 1)
      const depth = clamp(progress - i, 0, 5)
      if (reveal <= 0) {
        el.style.visibility = 'hidden'
        return
      }
      el.style.visibility = 'visible'
      if (!painted.current.has(i)) {
        painted.current.add(i)
        el.style.backgroundImage = `url(${paintFor(c.area, c.j)})`
      }
      // Neue Karte landet von unten und wächst dabei auf volle Größe.
      const e = 1 - Math.pow(1 - reveal, 3)
      const scale = (0.78 + 0.22 * e) * (1 - depth * 0.04)
      const lift = (narrow ? -depth * 12 : -depth * 16) + (1 - e) * 60
      el.style.transform = `translateY(${lift}px) scale(${scale})`
      // Schnell deckend, damit die Karte darunter nicht durchscheint.
      el.style.opacity = String(clamp(reveal * 7, 0, 1))
      el.style.setProperty('--dim', String(Math.min(0.5, depth * 0.12)))
      if (reveal > 0.6) el.dataset.live = ''
    })

    const idx = Math.min(N - 1, Math.round(progress))
    const k = flat[idx]?.k ?? 0
    setCount(idx + 1)
    if (k !== activeRef.current) {
      activeRef.current = k
      setActive(k)
    }
    const from = firstOf[k]
    const to = (firstOf[k + 1] ?? N) - 1
    pillRef.current?.style.setProperty('--p', String(to > from ? clamp((progress - from) / (to - from), 0, 1) : 1))
  }, [N, firstOf, flat, narrow, step])

  // Knopf rechts: Text weich tauschen, Pille nachziehen
  useEffect(() => {
    placePill(active)
    setLabelSwap(true)
    const t = setTimeout(() => {
      setLabel(areas[active]?.openLabel ?? '')
      setLabelSwap(false)
    }, 180)
    return () => clearTimeout(t)
  }, [active, areas, placePill])

  useLayoutEffect(() => {
    fit()
    render()
    placePill(activeRef.current, true)
  }, [fit, render, placePill])

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        render()
      })
    }
    let rz = 0
    const onResize = () => {
      clearTimeout(rz)
      rz = window.setTimeout(() => {
        fit()
        render()
        placePill(activeRef.current, true)
      }, 120)
    }
    // Inhalte (Daten) können nachträglich die Kartenhöhe ändern.
    const ro = new ResizeObserver(() => onResize())
    cardEls.current.forEach((el) => el?.firstElementChild && ro.observe(el.firstElementChild))
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(onResize)
    return () => {
      ro.disconnect()
      clearTimeout(rz)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [fit, render, placePill])

  // Gemalte Rahmen im Leerlauf vorbereiten, damit beim Scrollen nichts stockt.
  useEffect(() => {
    const idle: (cb: () => void) => number =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ??
      ((cb) => window.setTimeout(cb, 200))
    flat.forEach((c) => idle(() => paintFor(c.area, c.j)))
  }, [flat])

  const scrollToCard = useCallback(
    (i: number) => {
      const section = sectionRef.current
      if (!section) return
      const y = section.getBoundingClientRect().top + window.scrollY - STICKY_TOP + i * step() + 2
      window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    },
    [step]
  )
  useEffect(() => {
    if (jumpRef) jumpRef.current = (k) => scrollToCard(firstOf[k] ?? 0)
  }, [jumpRef, scrollToCard, firstOf])

  function onKey(e: React.KeyboardEvent) {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const k = clamp(active + d, 0, areas.length - 1)
    scrollToCard(firstOf[k])
    listRef.current?.querySelectorAll<HTMLButtonElement>('.sx-cat')[k]?.focus()
  }

  // Leichte Tiefe: der Stapel folgt der Maus ein wenig
  function onStageMove(e: React.PointerEvent) {
    if (narrow || prefersReducedMotion() || e.pointerType !== 'mouse') return
    const stage = stageRef.current
    if (!stage) return
    const r = stage.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    stage.style.translate = `${px * -8}px ${py * -6}px`
  }

  // Magnetischer Knopf
  function onBtnMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType !== 'mouse' || prefersReducedMotion()) return
    const b = e.currentTarget
    const r = b.getBoundingClientRect()
    b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`
  }

  return (
    <section className="sx" ref={sectionRef} aria-label={title}>
      <div className="sx-sticky" ref={stickyRef}>
        <h2 className="sx-title">{title}</h2>
        <div className="sx-grid">
          <div className="sx-cats-wrap">
            <ul className="sx-cats" ref={listRef} role="tablist" aria-label="Bereich wählen" onKeyDown={onKey}>
              {areas.map((a, k) => (
                <li key={a.id}>
                  <button
                    className={`sx-cat ${k === active ? 'is-active' : ''}`}
                    role="tab"
                    aria-selected={k === active}
                    onClick={() => scrollToCard(firstOf[k])}
                  >
                    {a.name}
                    <span className="sx-cat__count">{a.cards.length}</span>
                  </button>
                </li>
              ))}
            </ul>
            <span className="sx-pill" ref={pillRef} aria-hidden />
          </div>

          <div className="sx-stage" ref={stageRef} onPointerMove={onStageMove}>
            <div className="sx-glow" style={{ backgroundColor: areas[active]?.glow }} aria-hidden />
            <div className="sx-host" ref={hostRef}>
              {flat.map((c, i) => (
                <div
                  key={c.key}
                  ref={(el) => {
                    cardEls.current[i] = el
                  }}
                  className={`sx-screen ${c.dark ? 'is-dark' : ''}`}
                  style={{
                    left: `${narrow ? 4 : c.pos[0]}%`,
                    top: narrow ? '36px' : `${c.pos[1]}%`,
                    width: `${narrow ? 92 : c.pos[2]}%`,
                    zIndex: i + 1,
                    visibility: i === 0 ? 'visible' : 'hidden'
                  }}
                >
                  <div className="sx-in">{c.content}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="sx-open"
            onClick={() => areas[active]?.onOpen()}
            onPointerMove={onBtnMove}
            onPointerLeave={(e) => (e.currentTarget.style.transform = '')}
          >
            <span className={`sx-open__txt ${labelSwap ? 'is-swap' : ''}`}>{label}</span>
            <span aria-hidden>→</span>
          </button>
        </div>
        <div className="sx-hint">
          <span>Scrolle weiter – jede Karte legt sich oben auf den Stapel</span>
          <span className="sx-hint__count num">
            {count} / {N}
          </span>
        </div>
      </div>
    </section>
  )
}
