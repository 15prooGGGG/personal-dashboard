import type { NavItem } from '../nav.tsx'

// Platzhalter für Bereiche, deren Inhalt noch nicht gebaut ist.
// Sieht bewusst "im Aufbau" aus, nicht kaputt.
export default function PlaceholderSection({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <section className="placeholder">
      <div className="placeholder__icon">
        <Icon width={28} height={28} />
      </div>
      <h2 className="placeholder__title">{item.label}</h2>
      <p className="placeholder__text">
        Dieser Bereich ist noch im Aufbau. Hier kommt bald {item.label} rein.
      </p>
      <div className="placeholder__skeleton" aria-hidden>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </section>
  )
}
