import PriceChart from '../components/PriceChart.tsx'
import { ChevronRightIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import { formatCurrency, formatPercent, deltaClass } from '../lib/format.ts'
import { countdownLabel, daysUntil, relativeTime } from '../lib/time.ts'
import type { Quote, CalendarEvent, Todo, MailItem, NewsItem } from '../types.ts'
import { DEFAULT_SYMBOL } from './MarketsSection.tsx'

interface OverviewProps {
  quotes: Quote[]
  onOpen: (id: string) => void
}

function eventTime(ev: CalendarEvent): string {
  if (ev.allDay) return 'ganztägig'
  return new Date(ev.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function OverviewSection({ quotes, onOpen }: OverviewProps) {
  const cal = useApi<{ configured: boolean; events: CalendarEvent[] }>('/api/calendar', 10 * 60 * 1000)
  const todo = useApi<{ todos: Todo[] }>('/api/todos', 5 * 60 * 1000)
  const mail = useApi<{ configured: boolean; mails: MailItem[] }>('/api/mail', 5 * 60 * 1000)
  const news = useApi<{ items: NewsItem[] }>('/api/news?type=world', 15 * 60 * 1000)

  const hero = quotes.find((q) => q.symbol === DEFAULT_SYMBOL) ?? quotes[0]
  const events = cal.data?.events ?? []
  const today = events.filter((e) => daysUntil(e.start) === 0)
  const upcoming = events.slice(0, 4)
  const openTodos = (todo.data?.todos ?? []).filter((t) => !t.done)

  return (
    <div className="sec">
      <div className="bento">
        {/* Hero: der Wert, der dich am meisten interessiert */}
        <article className="card bento__wide">
          <div className="hero__top">
            <div>
              <div className="hero__name">{hero?.name ?? 'Märkte'}</div>
              <div className="hero__value">
                <span className="hero__price">
                  {hero?.price != null ? formatCurrency(hero.price, hero.currency) : '–'}
                </span>
                {hero?.changePercent != null && (
                  <span className={`delta ${deltaClass(hero.changePercent)}`}>
                    {formatPercent(hero.changePercent)}
                  </span>
                )}
              </div>
            </div>
            <button className="card__link" onClick={() => onOpen('stocks')}>
              Alle Kurse <ChevronRightIcon width={14} height={14} />
            </button>
          </div>
          <PriceChart symbol={hero?.symbol ?? DEFAULT_SYMBOL} range="1mo" interval="1d" small />
        </article>

        {/* Tagesüberblick in Zahlen */}
        <article className="card">
          <div className="card__head">
            <h3 className="card__title">Dein Tag</h3>
          </div>
          <div className="stat">
            <div className="stat__value">{today.length}</div>
            <div className="stat__label">{today.length === 1 ? 'Termin heute' : 'Termine heute'}</div>
          </div>
          <div className="stat">
            <div className="stat__value">{openTodos.length}</div>
            <div className="stat__label">
              {openTodos.length === 1 ? 'offene Aufgabe' : 'offene Aufgaben'}
            </div>
          </div>
          <div className="stat">
            <div className="stat__value">{mail.data?.mails?.length ?? 0}</div>
            <div className="stat__label">wichtige Mails</div>
          </div>
        </article>

        {/* Was als Nächstes ansteht */}
        <article className="card">
          <div className="card__head">
            <h3 className="card__title">Als Nächstes</h3>
            <button className="card__link" onClick={() => onOpen('calendar')}>
              Kalender <ChevronRightIcon width={14} height={14} />
            </button>
          </div>
          {cal.loading ? (
            <div className="state">Lädt …</div>
          ) : upcoming.length === 0 ? (
            <div className="state">Keine Termine.</div>
          ) : (
            <ul className="rows">
              {upcoming.map((ev) => (
                <li className="row" key={`${ev.id}-${ev.start}`}>
                  <div className="row__main">
                    <div className="row__title">{ev.title}</div>
                    <div className="row__meta">{eventTime(ev)}</div>
                  </div>
                  <span className={`cd ${daysUntil(ev.start) <= 1 ? 'is-soon' : ''}`}>
                    {countdownLabel(ev.start)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Offene Aufgaben */}
        <article className="card">
          <div className="card__head">
            <h3 className="card__title">Aufgaben</h3>
            <button className="card__link" onClick={() => onOpen('todo')}>
              Liste <ChevronRightIcon width={14} height={14} />
            </button>
          </div>
          {openTodos.length === 0 ? (
            <div className="state">Nichts offen. Schöner Tag.</div>
          ) : (
            <ul className="rows">
              {openTodos.slice(0, 5).map((t) => (
                <li className="row" key={t.id}>
                  <span className="todo__check" aria-hidden />
                  <div className="row__main">
                    <div className="row__title">{t.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Schlagzeilen */}
        <article className="card">
          <div className="card__head">
            <h3 className="card__title">Schlagzeilen</h3>
            <button className="card__link" onClick={() => onOpen('news')}>
              News <ChevronRightIcon width={14} height={14} />
            </button>
          </div>
          {news.loading ? (
            <div className="state">Lädt …</div>
          ) : (
            <ul className="rows">
              {(news.data?.items ?? []).slice(0, 3).map((n) => (
                <li key={n.id}>
                  <a className="news" href={n.url} target="_blank" rel="noopener noreferrer">
                    <span className="news__main">
                      <span className="news__title">{n.title}</span>
                      <span className="news__meta">
                        {n.source}
                        {n.publishedAt ? ` · ${relativeTime(n.publishedAt)}` : ''}
                      </span>
                    </span>
                    <ChevronRightIcon className="news__chev" width={15} height={15} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  )
}
