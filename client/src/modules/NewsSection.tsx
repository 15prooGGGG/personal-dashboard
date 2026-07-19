import PageSection from '../components/PageSection.tsx'
import { ChevronRightIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import { relativeTime } from '../lib/time.ts'
import type { NewsItem, IconComponent } from '../types.ts'

export default function NewsSection({
  type,
  title,
  icon
}: {
  type: 'world' | 'finance'
  title: string
  icon: IconComponent
}) {
  const { data, loading, error } = useApi<{ items: NewsItem[] }>(
    `/api/news?type=${type}`,
    15 * 60 * 1000
  )

  return (
    <PageSection title={title} icon={icon} note="RSS · aktualisiert stündlich">
      <div className="card">
        {loading ? (
          <div className="state">Lädt …</div>
        ) : error ? (
          <div className="state">{error}</div>
        ) : (
          <ul className="list">
            {(data?.items ?? []).map((n) => (
              <li key={n.id}>
                <a className="news" href={n.url} target="_blank" rel="noopener noreferrer">
                  <span className="news__main">
                    <span className="news__title">{n.title}</span>
                    <span className="news__meta">
                      {n.source}
                      {n.publishedAt ? ` · ${relativeTime(n.publishedAt)}` : ''}
                    </span>
                  </span>
                  <ChevronRightIcon className="news__chev" width={16} height={16} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageSection>
  )
}
