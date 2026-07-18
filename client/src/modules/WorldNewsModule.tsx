import { worldNews } from '../data/mock.ts'
import { relativeTime } from '../lib/time.ts'
import { ChevronRightIcon } from '../components/icons.tsx'

export default function WorldNewsModule() {
  return (
    <ul className="list">
      {worldNews.map((n) => (
        <li key={n.id}>
          <a className="news" href={n.url} target="_blank" rel="noopener noreferrer">
            <span className="news__main">
              <span className="news__title">{n.title}</span>
              <span className="muted news__meta">
                {n.source} · {relativeTime(n.publishedAt)}
              </span>
            </span>
            <ChevronRightIcon className="news__chev" width={16} height={16} />
          </a>
        </li>
      ))}
    </ul>
  )
}
