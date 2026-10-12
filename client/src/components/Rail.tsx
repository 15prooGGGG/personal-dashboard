import { useLayoutEffect, useRef, useState } from 'react'
import type { NavItem } from '../nav.tsx'
import { LogoMark, CollapseIcon } from './icons.tsx'

interface RailProps {
  items: NavItem[]
  activeId: string
  onSelect: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

// Linke Navigation: Marke oben, Bereiche darunter, Einklappen unten.
// Eingeklappt bleiben nur die Icons stehen; auf Mobil wird daraus eine Zeile.
export default function Rail({ items, activeId, onSelect, collapsed, onToggleCollapse }: RailProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const pillRef = useRef<HTMLLIElement>(null)
  // Die Markierung springt beim ersten Messen an ihren Platz und gleitet erst
  // danach – sonst fliegt sie beim Laden von der Ecke oben links herein.
  const [ready, setReady] = useState(false)

  // Gleitende Markierung hinter dem aktiven Eintrag. Gemessen wird über
  // offset*, das von Transforms (Hover, Druck) unberührt bleibt. Der
  // ResizeObserver hält sie beim Ein-/Ausklappen und auf Mobil (Zeile statt
  // Spalte) an ihrem Eintrag.
  useLayoutEffect(() => {
    const list = listRef.current
    const pill = pillRef.current
    if (!list || !pill) return
    const place = () => {
      // Gemessen wird das <li>: Es ist relativ zur Liste positioniert, der
      // Button darin nur relativ zu seinem <li>.
      const li = list.querySelector<HTMLElement>('.side__item.is-active')?.parentElement
      if (!li) return
      pill.style.transform = `translate(${li.offsetLeft}px, ${li.offsetTop}px)`
      pill.style.width = `${li.offsetWidth}px`
      pill.style.height = `${li.offsetHeight}px`
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(list)
    const raf = requestAnimationFrame(() => setReady(true))
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [activeId, collapsed])

  return (
    <nav className={`side ${collapsed ? 'is-collapsed' : ''}`} aria-label="Bereiche">
      <div className="side__brand">
        <span className="side__mark">
          <LogoMark width={17} height={17} />
        </span>
        <span className="side__wordmark">Briefing</span>
      </div>

      <ul className="side__nav" ref={listRef}>
        <li className={`side__pill ${ready ? 'is-ready' : ''}`} ref={pillRef} aria-hidden />
        {items.map((item) => {
          const Icon = item.icon
          const active = item.id === activeId
          return (
            <li key={item.id}>
              <button
                className={`side__item ${active ? 'is-active' : ''}`}
                onClick={() => onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span className="side__icon">
                  <Icon width={19} height={19} />
                </span>
                <span className="side__text">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="side__foot">
        <button className="side__collapse" onClick={onToggleCollapse}>
          <CollapseIcon width={18} height={18} />
          <span>{collapsed ? 'Ausklappen' : 'Einklappen'}</span>
        </button>
      </div>
    </nav>
  )
}
