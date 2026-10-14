import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Showcase from '../components/Showcase.tsx'
import type { ShowcaseArea } from '../components/Showcase.tsx'
import DayRuler from '../components/DayRuler.tsx'
import type { RulerBlock } from '../components/DayRuler.tsx'
import { useApi } from '../lib/useApi.ts'
import { useHistory } from '../lib/useStocks.ts'
import { formatCurrency, formatPercent } from '../lib/format.ts'
import { countdownLabel, daysUntil, greeting, relativeTime } from '../lib/time.ts'
import type { Quote, CalendarEvent, MailItem, SubstitutionPlan } from '../types.ts'
import { DEFAULT_SYMBOL } from './MarketsSection.tsx'

// ===========================================================================
// Startseite: ruhiger Kopf mit einem Satz über den Tag, darunter die Bühne
// „Was heute zählt“ (Scroll-Stapel, siehe Showcase.tsx) und der Tagesregler.
// ===========================================================================

interface WhoopData {
  configured: boolean
  connected: boolean
  recovery?: { score: number; hrv: number; restingHr: number } | null
  strain?: number | null
  sleep?: { performance: number; durationMs: number | null } | null
}
interface SleepNight {
  bedtime: string
  wake: string
  durationMs: number
  awakeMs: number
  lightMs: number
  deepMs: number
  remMs: number
  disturbances: number
  performance: number | null
  efficiency: number | null
  need: { baselineMs: number; debtMs: number; strainMs: number; napMs: number } | null
}
interface SleepData {
  connected: boolean
  days?: { sleep: SleepNight | null }[]
  coaching?: {
    recommendations: { id: string; kind: string; title: string; detail: string; basis: string }[]
    plan: { bedtime: string; wake: string; sleepTargetMs: number } | null
  }
}
interface Lesson {
  type: 'lesson' | 'break' | 'free'
  start: string | null
  end: string | null
  subject?: string | null
  room?: string | null
  period: number
}
interface PlanData {
  configured: boolean
  week: 'A' | 'B' | null
  day: string | null
  today: Lesson[]
  upcoming: { date: string; day: string; week: string; inDays: number; lessons: Lesson[] } | null
}
interface VaultData {
  configured: boolean
  counts?: { notes: number; projects: number; openTasks: number }
  projects?: { title: string; path: string; openTasks: number; doneTasks: number }[]
}

const hm = (ms: number) => {
  const min = Math.round(ms / 60000)
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}`
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
const weekday = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')

/** Aufeinanderfolgende Stunden im selben Fach zu einem Block zusammenfassen. */
function mergeLessons(lessons: Lesson[]) {
  const out: { subject: string; room: string; start: string; end: string; from: number; to: number }[] = []
  for (const l of lessons) {
    if (l.type !== 'lesson' || !l.start || !l.end) continue
    const prev = out[out.length - 1]
    // Gleiches Fach in direkt folgender Stunde = Doppelstunde (Pausen dazwischen egal).
    if (prev && prev.subject === l.subject && prev.to + 1 === l.period) {
      prev.end = l.end
      prev.to = l.period
    } else {
      out.push({ subject: l.subject ?? 'Unterricht', room: l.room ?? '', start: l.start, end: l.end, from: l.period, to: l.period })
    }
  }
  return out
}

const isExam = (e: CalendarEvent) => /klausur|klassenarbeit|prüfung/i.test(e.title)
/** „Klausur: Mathematik (LK + GK)“ → „Mathe“ */
function examName(title: string) {
  const s = title.replace(/^(klausur|klassenarbeit|prüfung)\s*:\s*/i, '').replace(/\s*\(.*\)\s*$/, '').trim()
  return s.replace(/^Mathematik/, 'Mathe')
}

// Kleine Bausteine für die Karten
function Top({ label, dot, right }: { label: string; dot?: string; right?: ReactNode }) {
  return (
    <div className="sx-top">
      <span className="sx-lab">
        {dot && <i style={{ background: dot }} />}
        {label}
      </span>
      {right}
    </div>
  )
}
const Loading = () => <div className="sx-meta">Lädt …</div>

export default function OverviewSection({ quotes, onOpen }: { quotes: Quote[]; onOpen: (id: string) => void }) {
  const whoop = useApi<WhoopData>('/api/whoop', 10 * 60 * 1000)
  const sleep = useApi<SleepData>('/api/sleep', 15 * 60 * 1000)
  const plan = useApi<PlanData>('/api/stundenplan', 10 * 60 * 1000)
  const subs = useApi<SubstitutionPlan>('/api/substitutions', 10 * 60 * 1000)
  const cal = useApi<{ configured: boolean; events: CalendarEvent[] }>('/api/calendar', 10 * 60 * 1000)
  const mail = useApi<{ configured: boolean; mails: MailItem[] }>('/api/mail', 5 * 60 * 1000)
  const vault = useApi<VaultData>('/api/vault', 10 * 60 * 1000)
  const { history } = useHistory(DEFAULT_SYMBOL, '1mo', '1d')

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const jump = useRef<((k: number) => void) | null>(null)

  // ---- abgeleitete Werte -------------------------------------------------
  const rec = whoop.data?.recovery ?? null
  const night = sleep.data?.days?.[0]?.sleep ?? null
  const coachPlan = sleep.data?.coaching?.plan ?? null
  const training = sleep.data?.coaching?.recommendations.find((r) => r.kind === 'training') ?? null
  const up = plan.data?.upcoming ?? null
  const upBlocks = up ? mergeLessons(up.lessons) : []
  const nowHm = now.toTimeString().slice(0, 5)
  const nextBlock = up && up.inDays === 0 ? upBlocks.find((b) => b.start > nowHm) ?? upBlocks[0] : upBlocks[0]
  const upLabel = !up ? '' : up.inDays === 0 ? 'heute' : up.inDays === 1 ? 'morgen' : `am ${up.day}`
  const events = cal.data?.events ?? []
  const exams = events.filter(isExam).filter((e) => daysUntil(e.start) >= 0).slice(0, 2)
  const agenda = events.filter((e) => !isExam(e)).slice(0, 4)
  const hero = quotes.find((q) => q.symbol === DEFAULT_SYMBOL) ?? quotes[0]

  // Projekte: Notizen in einem Projektordner zu einem Projekt zusammenfassen.
  const projects = useMemo(() => {
    const groups = new Map<string, { name: string; open: number; notes: { title: string; open: number }[] }>()
    for (const p of vault.data?.projects ?? []) {
      const seg = p.path.split('/')[1] ?? p.title
      const name = seg.replace(/\.md$/, '')
      const g = groups.get(name) ?? { name, open: 0, notes: [] }
      g.open += p.openTasks
      if (p.openTasks) g.notes.push({ title: p.title, open: p.openTasks })
      groups.set(name, g)
    }
    return [...groups.values()].sort((a, b) => b.open - a.open)
  }, [vault.data])
  const topProject = projects[0]

  // ---- Chart für den Depot-Screen ----------------------------------------
  const chart = useMemo(() => {
    const pts = history?.points.map((p) => p.close).filter((v): v is number => v != null) ?? []
    if (pts.length < 2) return null
    const W = 300, H = 90
    const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1
    const x = (i: number) => (i / (pts.length - 1)) * (W - 6) + 3
    const y = (v: number) => 6 + (1 - (v - min) / span) * (H - 12)
    let d = `M${x(0)} ${y(pts[0])}`
    for (let i = 1; i < pts.length; i++) {
      const mx = (x(i - 1) + x(i)) / 2
      d += ` C${mx} ${y(pts[i - 1])} ${mx} ${y(pts[i])} ${x(i)} ${y(pts[i])}`
    }
    return { d, area: `${d} L${x(pts.length - 1)} ${H} L${x(0)} ${H} Z` }
  }, [history])

  // ---- Bereiche & Screens ------------------------------------------------
  const stages = night
    ? [
        { label: 'Tief', ms: night.deepMs, c: '#2a3fae' },
        { label: 'REM', ms: night.remMs, c: '#5b7fff' },
        { label: 'Leicht', ms: night.lightMs, c: '#a9bcff' },
        { label: 'Wach', ms: night.awakeMs, c: '#ffb547' }
      ]
    : []
  const needMs = night?.need ? night.need.baselineMs + night.need.debtMs + night.need.strainMs - night.need.napMs : null

  const areas: ShowcaseArea[] = [
    {
      id: 'body',
      name: 'Körper',
      openLabel: 'Schlaf öffnen',
      glow: '#6fd3c0',
      onOpen: () => onOpen('sleep'),
      cards: [
        {
          key: 'whoop',
          pos: [3, 20, 52],
          content: !rec ? (
            <>
              <Top label="WHOOP · heute" />
              {whoop.loading ? <Loading /> : <div className="sx-meta">Keine Recovery-Daten.</div>}
            </>
          ) : (
            <>
              <Top
                label="WHOOP · heute"
                dot="var(--good)"
                right={<span className="sx-tag is-hot">{rec.score >= 67 ? 'grün' : rec.score >= 34 ? 'gelb' : 'rot'}</span>}
              />
              <div className="sx-ringwrap">
                <svg viewBox="0 0 72 72" aria-hidden>
                  <circle cx="36" cy="36" r="30" className="sx-ring-track" />
                  <circle cx="36" cy="36" r="30" className="sx-ring" style={{ ['--f' as string]: rec.score / 100 }} />
                </svg>
                <div>
                  <div className="sx-big num">
                    {Math.round(rec.score)}
                    <small>%</small>
                  </div>
                  <div className="sx-meta">
                    Recovery · HRV {Math.round(rec.hrv)} ms · Ruhepuls {Math.round(rec.restingHr)}
                  </div>
                </div>
              </div>
              {training && (
                <div className="sx-row">
                  <span>{training.title}</span>
                </div>
              )}
            </>
          )
        },
        {
          key: 'night',
          dark: true,
          pos: [55, 5, 33],
          content: !night ? (
            <>
              <Top label="Letzte Nacht" />
              {sleep.loading ? <Loading /> : <div className="sx-meta">Keine Schlafdaten.</div>}
            </>
          ) : (
            <>
              <Top label="Letzte Nacht" right={<span className="sx-meta">{clock(night.bedtime)}–{clock(night.wake)}</span>} />
              <div className="sx-big num">{hm(night.durationMs)}</div>
              <div className="sx-meta">
                {needMs ? `Bedarf ${hm(needMs)}` : ''}
                {night.performance != null ? ` · Performance ${Math.round(night.performance)} %` : ''}
              </div>
              <div className="sx-stages">
                {stages.map((s) => (
                  <span key={s.label} style={{ flex: s.ms, background: s.c }} />
                ))}
              </div>
              <div className="sx-legend">
                {stages.map((s) => (
                  <div key={s.label}>
                    {s.label}
                    <b>{hm(s.ms)}</b>
                  </div>
                ))}
              </div>
              <div className="sx-row">
                <span>Aufwacher</span>
                <b>{night.disturbances}</b>
              </div>
              {night.efficiency != null && (
                <div className="sx-row">
                  <span>Effizienz</span>
                  <b>{Math.round(night.efficiency)} %</b>
                </div>
              )}
              {coachPlan && <div className="sx-btn">Heute spätestens {coachPlan.bedtime} ins Bett</div>}
            </>
          )
        }
      ]
    },
    {
      id: 'school',
      name: 'Schule',
      openLabel: 'Stundenplan öffnen',
      glow: '#ff8f6b',
      onOpen: () => onOpen('stundenplan'),
      cards: [
        {
          key: 'lessons',
          dark: true,
          pos: [3, 10, 46],
          content: !up ? (
            <>
              <Top label="Stundenplan" />
              {plan.loading ? <Loading /> : <div className="sx-meta">Kein Unterricht in Sicht.</div>}
            </>
          ) : (
            <>
              <Top
                label={`${upLabel} · ${up.day.slice(0, 2)} ${up.week}`}
                dot="#ff8f6b"
                right={
                  subs.data?.configured ? (
                    <span className="sx-tag">{subs.data.total ? `${subs.data.total} Vertretung` : 'keine Vertretung'}</span>
                  ) : undefined
                }
              />
              {nextBlock && (
                <h3 className="sx-h">
                  {nextBlock.subject} um {nextBlock.start}
                </h3>
              )}
              {upBlocks.map((b) => (
                <div className="sx-lesson" key={`${b.start}-${b.subject}`}>
                  <time>{b.start}</time>
                  <b>{b.subject}</b>
                  {b.room && <span className="sx-tag">{b.room}</span>}
                </div>
              ))}
            </>
          )
        },
        {
          key: 'exams',
          pos: [51, 2, 45],
          content: (
            <>
              <Top label="Klausuren" />
              {exams.length === 0 ? (
                cal.loading ? <Loading /> : <div className="sx-meta">Keine Klausuren im Kalender.</div>
              ) : (
                <div className="sx-countdown">
                  {exams.map((e) => (
                    <div key={e.id}>
                      <div className="sx-big num">
                        {daysUntil(e.start)}
                        <small>{daysUntil(e.start) === 1 ? 'Tag' : 'Tage'}</small>
                      </div>
                      <div className="sx-meta">
                        {examName(e.title)} · {new Date(e.start).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        },
        {
          key: 'subs',
          pos: [51, 58, 45],
          content: (
            <>
              <Top
                label="Vertretungsplan"
                dot={subs.data?.total ? 'var(--warm)' : 'var(--good)'}
                right={subs.data?.fetchedAt ? <span className="sx-meta">{relativeTime(subs.data.fetchedAt)}</span> : undefined}
              />
              {!subs.data ? (
                subs.loading ? <Loading /> : <div className="sx-meta">Gerade nicht erreichbar.</div>
              ) : (
                <>
                  <h3 className="sx-h">{subs.data.total ? `${subs.data.total} Änderung${subs.data.total === 1 ? '' : 'en'}` : 'Keine Änderungen'}</h3>
                  {subs.data.who && <div className="sx-meta">{subs.data.who}</div>}
                </>
              )}
            </>
          )
        }
      ]
    },
    {
      id: 'money',
      name: 'Geld',
      openLabel: 'Aktien öffnen',
      glow: '#7aa2ff',
      onOpen: () => onOpen('stocks'),
      cards: [
        {
          key: 'hero',
          pos: [3, 10, 55],
          content: (
            <>
              <Top
                label={`${hero?.name ?? 'Depot'} · 1 Monat`}
                right={
                  hero?.changePercent != null ? (
                    <span className={`sx-tag ${hero.changePercent < 0 ? 'is-down' : 'is-hot'}`}>{formatPercent(hero.changePercent)} heute</span>
                  ) : undefined
                }
              />
              <div className="sx-big num">{hero?.price != null ? formatCurrency(hero.price, hero.currency) : '–'}</div>
              {chart ? (
                <svg className="sx-chart" viewBox="0 0 300 90" preserveAspectRatio="none" aria-label="Kursverlauf über einen Monat">
                  <defs>
                    <pattern id="sx-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent-deep)" strokeWidth="2.4" opacity="0.18" />
                    </pattern>
                  </defs>
                  <path d={chart.area} fill="url(#sx-hatch)" />
                  <path className="sx-chart-line" d={chart.d} pathLength={1} fill="none" stroke="var(--accent-deep)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              ) : (
                <div className="sx-meta">Verlauf lädt …</div>
              )}
            </>
          )
        },
        {
          key: 'watch',
          dark: true,
          pos: [58, 8, 32],
          content: (
            <>
              <Top label="Watchlist" />
              {quotes.slice(0, 5).map((q) => (
                <div className="sx-row" key={q.symbol}>
                  <span>{q.short ?? q.name}</span>
                  <b className="num">
                    {q.changePercent != null ? (
                      <span className={q.changePercent < 0 ? 'sx-down' : 'sx-up'}>{formatPercent(q.changePercent)}</span>
                    ) : (
                      '–'
                    )}
                  </b>
                </div>
              ))}
              <div className="sx-btn">Watchlist öffnen</div>
            </>
          )
        }
      ]
    },
    {
      id: 'projects',
      name: 'Projekte',
      openLabel: 'Second Brain öffnen',
      glow: '#c58ce8',
      onOpen: () => onOpen('vault'),
      cards: [
        {
          key: 'proj',
          pos: [4, 12, 51],
          content: (
            <>
              <Top
                label="Second Brain"
                right={vault.data?.counts ? <span className="sx-meta">{vault.data.counts.projects} aktiv · {vault.data.counts.openTasks} offen</span> : undefined}
              />
              {!topProject ? (
                vault.loading ? <Loading /> : <div className="sx-meta">Keine Projekte gefunden.</div>
              ) : (
                <>
                  <h3 className="sx-h">
                    {topProject.name}: {topProject.open} offene Punkte
                  </h3>
                  <div className="sx-bars">
                    {projects.slice(0, 4).map((p, i) => (
                      <div className="sx-bar" key={p.name}>
                        <span>{p.name}</span>
                        <b>{p.open}</b>
                        <i style={{ ['--v' as string]: `${(p.open / (topProject.open || 1)) * 100}%`, ['--c' as string]: ['#b36be0', 'var(--accent)', 'var(--good)', '#ffb547'][i] }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )
        },
        {
          key: 'projdetail',
          dark: true,
          pos: [56, 8, 34],
          content: (
            <>
              <Top label={topProject ? topProject.name : 'Projekt'} />
              {topProject ? (
                <>
                  <div className="sx-big num">{topProject.open}</div>
                  <div className="sx-meta">offene Punkte</div>
                  {topProject.notes.slice(0, 3).map((n) => (
                    <div className="sx-row" key={n.title}>
                      <span>{n.title}</span>
                      <b>{n.open}</b>
                    </div>
                  ))}
                </>
              ) : (
                <Loading />
              )}
            </>
          )
        }
      ]
    },
    {
      id: 'agenda',
      name: 'Termine',
      openLabel: 'Kalender öffnen',
      glow: '#9fd36b',
      onOpen: () => onOpen('calendar'),
      cards: [
        {
          key: 'events',
          pos: [4, 12, 50],
          content: (
            <>
              <Top label="Kalender · nächste Tage" />
              {agenda.length === 0 ? (
                cal.loading ? <Loading /> : <div className="sx-meta">Keine Termine.</div>
              ) : (
                agenda.map((e) => (
                  <div className="sx-row" key={`${e.id}-${e.start}`}>
                    <span>
                      <b>{e.title}</b>
                      <br />
                      <span className="sx-meta">
                        {weekday(e.start)} · {e.allDay ? 'ganztägig' : clock(e.start)}
                      </span>
                    </span>
                    <span className={`sx-tag ${daysUntil(e.start) <= 1 ? 'is-hot' : ''}`}>{countdownLabel(e.start)}</span>
                  </div>
                ))
              )}
            </>
          )
        },
        {
          key: 'mail',
          dark: true,
          pos: [54, 10, 38],
          content: (
            <>
              <Top label="Postfach · wichtig" right={mail.data?.mails?.length ? <span className="sx-tag">{mail.data.mails.length}</span> : undefined} />
              {(mail.data?.mails ?? []).length === 0 ? (
                mail.loading ? <Loading /> : <div className="sx-meta">Nichts Wichtiges.</div>
              ) : (
                mail.data!.mails.slice(0, 3).map((m) => (
                  <div className="sx-row" key={m.id}>
                    <span>
                      <b>{m.subject}</b>
                      <br />
                      <span className="sx-meta">
                        {m.sender} · {relativeTime(m.receivedAt)}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </>
          )
        }
      ]
    }
  ]

  // ---- Tagesregler -------------------------------------------------------
  const todayBlocks = plan.data?.day ? mergeLessons(plan.data.today) : []
  const bedtime = coachPlan?.bedtime ?? null
  const rulerBlocks: RulerBlock[] = [
    ...todayBlocks.map((b) => ({
      start: b.start,
      end: b.end,
      name: b.subject,
      kind: 'school' as const,
      info: `${b.room ? `${b.room} · ` : ''}${b.from === b.to ? `${b.from}.` : `${b.from}.–${b.to}.`} Stunde`
    }))
  ]
  const freeFrom = todayBlocks.length ? todayBlocks[todayBlocks.length - 1].end : '06:00'
  const bedOk = bedtime && (bedtime >= '18:00' || bedtime <= '03:00')
  rulerBlocks.push({
    start: freeFrom,
    end: bedOk ? bedtime! : '03:00',
    name: 'Frei',
    kind: 'free',
    info: training ? training.title : 'Freie Zeit'
  })
  if (bedOk && bedtime !== '03:00') {
    rulerBlocks.push({ start: bedtime!, end: '03:00', name: 'Schlaf', kind: 'sleep', info: `Ziel ${coachPlan ? hm(coachPlan.sleepTargetMs) : ''}` })
  }

  // ---- Kopf: ein Satz über den Tag ---------------------------------------
  const words = `${greeting(now)}, Lauri.`.split(' ')
  const examSoon = exams[0]
  const Tok = ({ k, children, dot }: { k: number; children: ReactNode; dot?: string }) => (
    <button className="ov-tok" onClick={() => jump.current?.(k)}>
      {dot && <i style={{ background: dot }} />}
      {children}
    </button>
  )
  const clauses: ReactNode[] = []
  if (rec)
    clauses.push(
      <>
        Du bist zu{' '}
        <Tok k={0} dot={rec.score >= 67 ? 'var(--good)' : rec.score >= 34 ? 'var(--amber)' : 'var(--down)'}>
          {Math.round(rec.score)} % erholt
        </Tok>
      </>
    )
  if (up && nextBlock)
    clauses.push(
      <>
        {up.inDays === 0 ? 'als Nächstes kommt' : `${upLabel} beginnt um`}{' '}
        <Tok k={1}>
          {nextBlock.start} {nextBlock.subject}
        </Tok>
      </>
    )
  if (examSoon)
    clauses.push(
      <>
        {examName(examSoon.title)} ist in <Tok k={1}>{countdownLabel(examSoon.start).replace('in ', '')}</Tok>
      </>
    )

  return (
    <div className="ov">
      <header className="ov-head">
        <div className="ov-meta">
          <span className="ov-live">
            <i />
            Live
          </span>
          <span>
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            {plan.data?.week ? ` · ${plan.data.week}-Woche` : ''}
          </span>
          <span className="num">{now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <h1 className="ov-title">
          {/* Leerzeichen außerhalb der inline-block-Spans, sonst verschluckt. */}
          {words.map((w, i) => (
            <Fragment key={i}>
              {i > 0 && ' '}
              <span className="ov-w" style={{ ['--w' as string]: i }}>
                {w}
              </span>
            </Fragment>
          ))}
        </h1>
        {clauses.length > 0 && (
          <p className="ov-line">
            {clauses.map((c, i) => (
              <Fragment key={i}>
                {i > 0 && (i === clauses.length - 1 ? ' und ' : ', ')}
                <span className="ov-w" style={{ ['--w' as string]: i + 3 }}>
                  {c}
                </span>
              </Fragment>
            ))}
            .
          </p>
        )}
      </header>

      <Showcase title="Was heute zählt" areas={areas} jumpRef={jump} />

      <DayRuler
        title={`Dein ${now.toLocaleDateString('de-DE', { weekday: 'long' })} zum Ziehen`}
        blocks={rulerBlocks}
        bedtime={bedOk ? bedtime : null}
      />
    </div>
  )
}
