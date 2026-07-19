import type { ReactNode } from 'react'
import type { IconComponent } from '../types.ts'

interface CardProps {
  title: string
  icon: IconComponent
  experimental?: boolean
  children: ReactNode
}

export default function Card({ title, icon: Icon, experimental, children }: CardProps) {
  return (
    <section className="card">
      <header className="card__head">
        <span className="card__icon">
          <Icon />
        </span>
        <h3 className="card__title">{title}</h3>
        {experimental && <span className="tag">experimentell</span>}
      </header>
      <div>{children}</div>
    </section>
  )
}
