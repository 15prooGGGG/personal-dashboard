import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

// ===========================================================================
// Bewegung – gemeinsame Helfer.
// ---------------------------------------------------------------------------
// Die Kurven und Dauern selbst stehen als CSS-Variablen in index.css
// (--ease-out, --dur-*). Hier liegt nur, was JavaScript braucht: dieselbe
// Kurve für Zahlen, die hochzählen, und das gestaffelte Einblenden der Karten.
// ===========================================================================

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Entspricht ungefähr cubic-bezier(.23,1,.32,1): schneller Start, langes Auslaufen.
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * Zählt von der zuletzt gezeigten Zahl zur neuen. Beim ersten Erscheinen
 * startet die Zahl bei 0, danach gleitet sie von Wert zu Wert, z. B. wenn
 * ein Kurs nachgeladen wird.
 */
export function useCountUp(value: number | null | undefined, duration = 900): number | null {
  const [shown, setShown] = useState<number | null>(() =>
    value == null ? null : prefersReducedMotion() ? value : 0
  )
  const current = useRef(shown ?? 0)

  useEffect(() => {
    if (value == null) {
      setShown(null)
      return
    }
    if (prefersReducedMotion()) {
      current.current = value
      setShown(value)
      return
    }
    const from = current.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const v = from + (value - from) * easeOutExpo(t)
      current.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return shown
}

/** true ab dem ersten Frame nach dem Einhängen – Startwert für CSS-Übergänge. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return mounted
}

const REVEAL = '.card, .tile, .sec__head'
const MAX_STEPS = 12

/**
 * Gibt jeder Karte in `ref` ihre Position in der Reihenfolge (--i). Daraus
 * berechnet das CSS die Verzögerung des Einblendens. Karten, die erst später
 * erscheinen (nach "Lädt …"), bekommen eine eigene, kurze Staffel.
 */
export function useStaggerReveal(ref: RefObject<HTMLElement | null>, key: unknown) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const stamp = (els: Element[]) =>
      els.forEach((el, i) => (el as HTMLElement).style.setProperty('--i', String(Math.min(i, MAX_STEPS))))

    stamp(Array.from(root.querySelectorAll(REVEAL)))

    const mo = new MutationObserver((records) => {
      const fresh: Element[] = []
      for (const r of records)
        r.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return
          if (n.matches(REVEAL)) fresh.push(n)
          fresh.push(...n.querySelectorAll(REVEAL))
        })
      if (fresh.length) stamp(fresh)
    })
    mo.observe(root, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [ref, key])
}
