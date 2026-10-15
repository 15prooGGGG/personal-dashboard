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
// den Stapel. Ältere Karten rücken nach hinten und bleiben liegen.
//
// Performance – bewusst so gebaut:
// - Pro Frame nur transform/opacity schreiben (beides läuft auf der GPU), und
//   nur, wenn sich der Wert geändert hat. Keine CSS-Variablen pro Frame: die
//   ließen den ganzen Karteninhalt neu berechnen.
// - Der gezeigte Fortschritt folgt dem Scroll weich (zeitbasiert), damit
//   Mausrad-Sprünge nicht als Ruckler im Stapel ankommen.
// - Gemessen wird nur beim Start, bei echter Größenänderung und wenn sich der
//   Inhalt einer Karte wirklich ändert – und immer im UNskalierten Zustand.
//   (Vorher wurde im verkleinerten Zustand gemessen; das schaukelte sich auf
//   und die Bühne pendelte ständig zwischen zwei Größen.)
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

interface CardState {
  tf: string
  op: string
  dim: string
  vis: boolean
  painted: boolean
  live: boolean
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
  const pillBarRef = useRef<HTMLSpanElement>(null)
  const cardEls = useRef<(HTMLDivElement | null)[]>([])
  const dimEls = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [count, setCount] = useState(1)
  const [labelSwap, setLabelSwap] = useState(false)
  const [label, setLabel] = useState(areas[0]?.openLabel ?? '')

  // Struktur (welche Karte gehört zu welchem Bereich) getrennt vom Inhalt:
  // neue Daten sollen nicht jedes Mal alles neu aufsetzen.
  const shape = areas.map((a) => `${a.id}:${a.cards.map((c) => c.key).join(',')}`).join('|')
  const flat = useMemo(
    () => areas.flatMap((a, k) => a.cards.map((c, j) => ({ key: c.key, dark: c.dark, pos: c.pos, k, j, area: a.id }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape]
  )
  const contents = areas.flatMap((a) => a.cards.map((c) => c.content))
  const N = flat.length
  const firstOf = useMemo(() => areas.map((_, k) => flat.findIndex((c) => c.k === k)), [flat, areas])

  // Alles, was die Scroll-Schleife braucht, in einer Ref – so bleibt sie stabil.
  const st = useRef({
    narrow,
    flat,
    firstOf,
    vh: window.innerHeight,
    width: window.innerWidth,
    scale: 1,
    natural: '',
    target: 0,
    shown: 0,
    raf: 0,
    lastT: 0,
    cache: [] as CardState[],
    activeK: 0,
    idx: 0
  })
  st.current.narrow = narrow
  st.current.flat = flat
  st.current.firstOf = firstOf

  const step = useCallback(() => (st.current.narrow ? 0.42 : 0.5) * st.current.vh, [])

  // ---- Messen & Bühnenhöhe ------------------------------------------------
  const applyScale = useCallback((heights: number[]) => {
    const s = st.current
    const host = hostRef.current
    if (!host) return
    host.style.transform = s.scale < 1 ? `scale(${s.scale})` : ''
    host.style.width = s.scale < 1 ? `${100 / s.scale}%` : ''
    host.style.left = s.scale < 1 ? `${(100 - 100 / s.scale) / 2}%` : ''
    if (s.narrow) {
      const h = Math.max(...heights)
      cardEls.current.forEach((el) => el && (el.style.height = `${h}px`))
    }
  }, [])

  const fit = useCallback(
    (force = false) => {
      const s = st.current
      const stage = stageRef.current, host = hostRef.current, sticky = stickyRef.current, section = sectionRef.current
      if (!stage || !host || !sticky || !section) return
      const els = cardEls.current.slice(0, s.flat.length).filter(Boolean) as HTMLDivElement[]
      if (!els.length) return

      // Immer im unskalierten Zustand messen.
      host.style.transform = ''
      host.style.width = ''
      host.style.left = ''
      els.forEach((el) => (el.style.height = ''))
      const heights = els.map((el) => el.offsetHeight)
      const natural = `${stage.offsetWidth}|${s.vh}|${s.narrow}|${heights.join(',')}`
      if (!force && natural === s.natural) {
        applyScale(heights) // nichts Relevantes geändert
        return
      }
      s.natural = natural

      section.style.height = `${Math.round((s.flat.length - 1) * step() + s.vh + 120)}px`
      let need: number
      if (s.narrow) {
        need = Math.max(...heights) + 36 + 70 // Platz für die oben herausschauenden Karten
      } else {
        need = Math.max(...els.map((el) => el.offsetTop + el.offsetHeight)) + 70
        need = Math.max(need, stage.offsetWidth / 1.6)
      }
      const head = (sticky.querySelector('.sx-title') as HTMLElement | null)?.offsetHeight ?? 0
      const avail = Math.max(260, s.vh - 24 - head - (s.narrow ? 150 : 90))
      s.scale = Math.min(1, avail / need)
      stage.style.height = `${Math.round(need * s.scale)}px`
      applyScale(heights)
    },
    [applyScale, step]
  )

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

  // ---- Zeichnen (nur transform/opacity, nur bei Änderung) ----------------
  const draw = useCallback((progress: number) => {
    const s = st.current
    const n = s.flat.length
    for (let i = 0; i < n; i++) {
      const el = cardEls.current[i]
      if (!el) continue
      const c = (s.cache[i] ||= { tf: '', op: '', dim: '', vis: true, painted: false, live: false })
      const reveal = i === 0 ? 1 : clamp(progress - i + 1, 0, 1)
      const vis = reveal > 0
      if (vis !== c.vis) {
        el.style.visibility = vis ? 'visible' : 'hidden'
        c.vis = vis
      }
      if (!vis) continue
      if (!c.painted) {
        c.painted = true
        el.style.backgroundImage = `url(${paintFor(s.flat[i].area, s.flat[i].j)})`
      }
      const depth = clamp(progress - i, 0, 5)
      // Neue Karte landet von unten und wächst dabei auf volle Größe.
      const e = 1 - Math.pow(1 - reveal, 3)
      const scale = (0.8 + 0.2 * e) * (1 - depth * 0.04)
      const lift = (s.narrow ? -depth * 12 : -depth * 16) + (1 - e) * 56
      const tf = `translate3d(0,${lift.toFixed(1)}px,0) scale(${scale.toFixed(4)})`
      if (tf !== c.tf) {
        el.style.transform = tf
        c.tf = tf
      }
      const op = clamp(reveal * 7, 0, 1).toFixed(2)
      if (op !== c.op) {
        el.style.opacity = op
        c.op = op
      }
      const dim = Math.min(0.5, depth * 0.12).toFixed(2)
      if (dim !== c.dim) {
        const d = dimEls.current[i]
        if (d) d.style.opacity = dim
        c.dim = dim
      }
      if (!c.live && reveal > 0.6) {
        c.live = true
        el.setAttribute('data-live', '')
      }
    }

    const idx = Math.min(n - 1, Math.round(progress))
    if (idx !== s.idx) {
      s.idx = idx
      setCount(idx + 1)
    }
    const k = s.flat[idx]?.k ?? 0
    if (k !== s.activeK) {
      s.activeK = k
      setActive(k)
    }
    const from = s.firstOf[k]
    const to = (s.firstOf[k + 1] ?? n) - 1
    const p = to > from ? clamp((progress - from) / (to - from), 0, 1) : 1
    if (pillBarRef.current) pillBarRef.current.style.transform = `scaleX(${p.toFixed(3)})`
  }, [])

  // Ziel aus der Scrollposition; der gezeigte Wert folgt weich.
  const readTarget = useCallback(() => {
    const section = sectionRef.current
    if (!section) return 0
    const n = st.current.flat.length
    const range = (n - 1) * step()
    const top = section.getBoundingClientRect().top - STICKY_TOP
    return clamp(-top / range, 0, 1) * (n - 1)
  }, [step])

  const tick = useCallback(
    (now: number) => {
      const s = st.current
      const dt = s.lastT ? Math.min(64, now - s.lastT) : 16
      s.lastT = now
      const diff = s.target - s.shown
      if (prefersReducedMotion() || Math.abs(diff) < 0.002) {
        s.shown = prefersReducedMotion() ? Math.round(s.target) : s.target
        draw(s.shown)
        s.raf = 0
        s.lastT = 0
        return
      }
      s.shown += diff * (1 - Math.exp(-dt / 70)) // ~70 ms Nachlauf, unabhängig von 60/120 Hz
      draw(s.shown)
      s.raf = requestAnimationFrame(tick)
    },
    [draw]
  )
  const kick = useCallback(() => {
    const s = st.current
    s.target = readTarget()
    if (!s.raf) s.raf = requestAnimationFrame(tick)
  }, [readTarget, tick])

  // Knopf rechts: Text weich tauschen, Pille nachziehen
  useEffect(() => {
    placePill(active)
    setLabelSwap(true)
    const t = setTimeout(() => {
      setLabel(areas[active]?.openLabel ?? '')
      setLabelSwap(false)
    }, 180)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, placePill])

  // Start sowie Wechsel Handy/Desktop oder der Kartenstruktur
  useLayoutEffect(() => {
    const s = st.current
    s.cache = []
    s.idx = -1
    fit(true)
    s.target = readTarget()
    s.shown = s.target
    draw(s.shown)
    placePill(s.activeK, true)
  }, [fit, readTarget, draw, placePill, narrow, flat])

  useEffect(() => {
    const s = st.current
    const onScroll = () => kick()
    let rz = 0
    const onResize = () => {
      clearTimeout(rz)
      rz = window.setTimeout(() => {
        // Nur echte Größenänderungen: Auf dem Handy ändert die ein-/ausfahrende
        // Adressleiste laufend die Höhe – das soll nichts neu vermessen.
        const w = window.innerWidth, h = window.innerHeight
        if (w === s.width && Math.abs(h - s.vh) < 140) return
        s.width = w
        s.vh = h
        fit(true)
        kick()
        placePill(s.activeK, true)
      }, 150)
    }
    // Inhalte (Daten) können nachträglich die Kartenhöhe ändern.
    let roFrame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(roFrame)
      roFrame = requestAnimationFrame(() => {
        fit()
        kick()
      })
    })
    cardEls.current.forEach((el) => {
      const inner = el?.querySelector('.sx-in')
      if (inner) ro.observe(inner)
    })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(() => {
      fit(true)
      kick()
    })
    return () => {
      ro.disconnect()
      clearTimeout(rz)
      cancelAnimationFrame(roFrame)
      cancelAnimationFrame(s.raf)
      s.raf = 0
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [fit, kick, placePill, flat])

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
            <span className="sx-pill" ref={pillRef} aria-hidden>
              <span className="sx-pill__bar" ref={pillBarRef} />
            </span>
          </div>

          <div className="sx-stage" ref={stageRef}>
            {/* Farbschein: je Bereich eine Ebene, gewechselt wird nur die Deckkraft. */}
            {areas.map((a, k) => (
              <div
                key={a.id}
                className={`sx-glow ${k === active ? 'is-on' : ''}`}
                style={{ backgroundImage: `radial-gradient(closest-side, ${a.glow}, transparent)` }}
                aria-hidden
              />
            ))}
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
                    zIndex: i + 1
                  }}
                >
                  <div className="sx-in">{contents[i]}</div>
                  <div
                    className="sx-dim"
                    ref={(el) => {
                      dimEls.current[i] = el
                    }}
                    aria-hidden
                  />
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
