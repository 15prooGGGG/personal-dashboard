// Basiskarte für jedes Briefing-Modul. Sorgt für einheitliche Struktur:
// Titelzeile (Icon + Titel + optionaler Hinweis) und Inhaltsbereich.
import type { ReactNode } from 'react'
import type { IconComponent, CardSpan } from '../types.ts'

interface CardProps {
  id: string
  title: string
  icon: IconComponent
  span?: CardSpan
  experimental?: boolean
  children: ReactNode
}

export default function Card({ id, title, icon: Icon, span = 'sm', experimental, children }: CardProps) {
  return (
    <section
      id={`module-${id}`}
      className={`card card--${span}`}
      aria-labelledby={`title-${id}`}
      style={{ scrollMarginTop: '1.5rem' }}
    >
      <header className="card__head">
        <span className="card__icon">
          <Icon />
        </span>
        <h2 id={`title-${id}`} className="card__title">
          {title}
        </h2>
        {experimental && <span className="tag tag--exp">experimentell</span>}
      </header>
      <div className="card__body">{children}</div>
    </section>
  )
}
