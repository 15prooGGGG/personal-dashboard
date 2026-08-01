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
  return (
    <nav className={`side ${collapsed ? 'is-collapsed' : ''}`} aria-label="Bereiche">
      <div className="side__brand">
        <span className="side__mark">
          <LogoMark width={17} height={17} />
        </span>
        <span className="side__wordmark">Briefing</span>
      </div>

      <ul className="side__nav">
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
