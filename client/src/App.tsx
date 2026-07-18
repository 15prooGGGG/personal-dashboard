import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.tsx'
import Card from './components/Card.tsx'
import Ticker from './components/Ticker.tsx'
import { SparkIcon } from './components/icons.tsx'
import { MODULES } from './modules/registry.tsx'
import { watchlist } from './data/mock.ts'

export default function App() {
  // Experimentelle Module (z. B. Budget) lassen sich ausblenden.
  const [showExperimental, setShowExperimental] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(MODULES[0]?.id ?? null)
  const mainRef = useRef<HTMLElement>(null)

  const visibleModules = useMemo(
    () => MODULES.filter((m) => showExperimental || !m.experimental),
    [showExperimental]
  )

  // Scroll-Spy: markiert das aktuell sichtbare Modul in der Navigation.
  useEffect(() => {
    const sections = visibleModules
      .map((m) => document.getElementById(`module-${m.id}`))
      .filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActiveId(visible.target.id.replace('module-', ''))
      },
      { root: null, rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] }
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [visibleModules])

  return (
    <div className="layout">
      <Sidebar modules={visibleModules} activeId={activeId} />

      <main className="content" ref={mainRef}>
        <div className="content__topbar">
          <Ticker items={watchlist} />
          <label className="toggle">
            <input
              type="checkbox"
              checked={showExperimental}
              onChange={(e) => setShowExperimental(e.target.checked)}
            />
            <SparkIcon width={15} height={15} />
            <span>Experimentelle Module</span>
          </label>
        </div>

        <div className="grid">
          {visibleModules.map((m) => (
            <Card
              key={m.id}
              id={m.id}
              title={m.title}
              icon={m.icon}
              span={m.span}
              experimental={m.experimental}
            >
              <m.Component />
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
