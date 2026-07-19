import type { ReactNode } from 'react'
import type { IconComponent } from '../types.ts'

// Einheitlicher Kopf + Rahmen für einen Bereich (Kalender, Mail, News, …).
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
    <section className="section">
      <div className="section__head">
        <h2 className="section__title section__title--icon">
          {Icon && (
            <span className="section__icon">
              <Icon width={18} height={18} />
            </span>
          )}
          {title}
        </h2>
        {note && <span className="section__note">{note}</span>}
      </div>
      {children}
    </section>
  )
}
