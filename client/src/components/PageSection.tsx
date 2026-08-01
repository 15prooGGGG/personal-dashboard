import type { ReactNode } from 'react'
import type { IconComponent } from '../types.ts'

// Einheitlicher Kopf für einen Bereich (Kalender, Mail, News, To-Do).
export default function PageSection({
  title,
  icon: Icon,
  note,
  children
}: {
  title: string
  icon?: IconComponent
  note?: string
  children: ReactNode
}) {
  return (
    <section className="sec">
      <div className="sec__head">
        <h2 className="sec__title">
          {Icon && (
            <span className="sec__icon">
              <Icon width={18} height={18} />
            </span>
          )}
          {title}
        </h2>
        {note && <span className="sec__note">{note}</span>}
      </div>
      {children}
    </section>
  )
}
