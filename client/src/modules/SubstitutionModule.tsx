import { substitutions } from '../data/mock.ts'
import type { SubstitutionKind } from '../types.ts'

const kindLabel: Record<SubstitutionKind, string> = {
  cancelled: 'Entfall',
  'room-change': 'Raum',
  substitution: 'Vertretung'
}

export default function SubstitutionModule() {
  if (substitutions.length === 0) return <p className="state">Heute keine Änderungen.</p>
  return (
    <ul className="list">
      {substitutions.map((s) => (
        <li className="row" key={s.id}>
          <span className={`chip chip--${s.kind}`}>{kindLabel[s.kind]}</span>
          <span className="row__main">
            <span className="row__title">
              {s.lesson} · {s.subject}
            </span>
            <span className="muted"> — {s.note}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
