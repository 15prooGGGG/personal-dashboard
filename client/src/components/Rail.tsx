import type { NavItem } from '../nav.tsx'

interface RailProps {
  items: NavItem[]
  activeId: string
  onSelect: (id: string) => void
}

// Schmale linke Navigationsleiste. Icons wechseln den Bereich; das Label
// erscheint als Tooltip beim Überfahren.
export default function Rail({ items, activeId, onSelect }: RailProps) {
  return (
    <nav className="rail" aria-label="Bereiche">
      <ul className="rail__list">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.id === activeId
          return (
            <li key={item.id}>
              <button
                className={`rail__item ${active ? 'is-active' : ''}`}
                onClick={() => onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
              >
                <Icon width={22} height={22} />
                <span className="rail__tip">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
