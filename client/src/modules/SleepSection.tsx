import { useState } from 'react'
import PageSection from '../components/PageSection.tsx'
import SleepChart from '../components/SleepChart.tsx'
import { WhoopConnect } from '../components/WhoopCard.tsx'
import { MoonIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import CountUp from '../components/CountUp.tsx'

interface Sleep {
  bedtime: string
  wake: string
  durationMs: number
  inBedMs: number
  awakeMs: number
  lightMs: number
  deepMs: number
  remMs: number
  cycles: number
  disturbances: number
  performance: number | null
  efficiency: number | null
  consistency: number | null
  respiratoryRate: number | null
  need: { baselineMs: number; debtMs: number; strainMs: number; napMs: number } | null
}
interface Day {
  cycleId: number
  start: string
  sleep: Sleep | null
  recovery: { score: number; hrv: number; restingHr: number } | null
  strain: number | null
  steps: number | null
  workouts: { sport: string; start: string; strain: number | null; avgHr: number | null }[]
}
interface Recommendation {
  id: string
  kind: 'training' | 'sleep' | 'body' | 'day'
  title: string
  detail: string
  basis: string
}
interface SleepResponse {
  configured: boolean
  connected: boolean
  workoutsAvailable?: boolean
  days?: Day[]
  coaching?: {
    focus: string | null
    recommendations: Recommendation[]
    plan: { bedtime: string; wake: string; sleepTargetMs: number } | null
  }
}

function dur(ms: number) {
  const min = Math.round(Math.abs(ms) / 60000)
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}`
}
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
const pct = (v: number) => `${Math.round(v)} %`

// Kennzahlen, die der Chart zeigen kann – wie die Kurs-Kacheln bei Aktien.
const METRICS = [
  {
    key: 'duration',
    label: 'Schlafdauer',
    pick: (d: Day) => (d.sleep ? d.sleep.durationMs / 3600000 : null),
    format: (v: number) => dur(v * 3600000),
    axis: (v: number) => `${Math.round(v)}h`,
    delta: (a: number, b: number) => `${a >= b ? '+' : '−'}${dur((a - b) * 3600000)}`
  },
  {
    key: 'performance',
    label: 'Schlaf-Performance',
    pick: (d: Day) => d.sleep?.performance ?? null,
    format: pct,
    axis: (v: number) => `${Math.round(v)}`,
    delta: (a: number, b: number) => `${a >= b ? '+' : '−'}${Math.abs(Math.round(a - b))} %`
  },
  {
    key: 'recovery',
    label: 'Recovery',
    pick: (d: Day) => d.recovery?.score ?? null,
    format: pct,
    axis: (v: number) => `${Math.round(v)}`,
    delta: (a: number, b: number) => `${a >= b ? '+' : '−'}${Math.abs(Math.round(a - b))} %`
  },
  {
    key: 'hrv',
    label: 'HRV',
    pick: (d: Day) => d.recovery?.hrv ?? null,
    format: (v: number) => `${Math.round(v)} ms`,
    axis: (v: number) => `${Math.round(v)}`,
    delta: (a: number, b: number) => `${a >= b ? '+' : '−'}${Math.abs(Math.round(a - b))} ms`
  }
] as const
type MetricKey = (typeof METRICS)[number]['key']

const RANGES = [
  { key: '7T', days: 7 },
  { key: '14T', days: 14 },
  { key: '30T', days: 30 }
] as const

const KIND_LABEL: Record<Recommendation['kind'], string> = {
  training: 'Training',
  sleep: 'Schlaf',
  body: 'Körper',
  day: 'Tag'
}

export default function SleepSection() {
  const { data, loading, error, reload } = useApi<SleepResponse>('/api/sleep', 10 * 60 * 1000)
  const [metric, setMetric] = useState<MetricKey>('duration')
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['key']>('14T')

  if (loading) {
    return (
      <PageSection title="Schlaf" icon={MoonIcon}>
        <div className="state">Lädt …</div>
      </PageSection>
    )
  }
  if (error || !data) {
    return (
      <PageSection title="Schlaf" icon={MoonIcon}>
        <div className="state">{error ?? 'Gerade nicht verfügbar.'}</div>
      </PageSection>
    )
  }
  if (!data.configured || !data.connected) {
    return (
      <PageSection title="Schlaf" icon={MoonIcon}>
        <div className="card">
          {data.configured ? (
            <WhoopConnect onDone={reload} />
          ) : (
            <div className="state">
              WHOOP ist noch nicht eingerichtet – Anleitung in <code>CONNECT.md</code>.
            </div>
          )}
        </div>
      </PageSection>
    )
  }

  const days = data.days ?? []
  const coaching = data.coaching
  const nights = days.filter((d) => d.sleep)
  const last = nights[0]?.sleep ?? null
  const range = RANGES.find((r) => r.key === rangeKey)!
  const m = METRICS.find((x) => x.key === metric)!

  // Chart: älteste zuerst, Datum = Aufwachtag.
  const series = days
    .slice(0, range.days)
    .map((d) => ({ t: new Date(d.sleep?.wake ?? d.start).getTime(), v: m.pick(d) }))
    .filter((p): p is { t: number; v: number } => p.v != null)
    .reverse()
  const latest = series.at(-1)?.v ?? null
  const before = series.at(-2)?.v ?? null

  const stageTotal = last ? last.deepMs + last.remMs + last.lightMs + last.awakeMs : 0
  const stages = last
    ? [
        { key: 'deep', label: 'Tief', ms: last.deepMs },
        { key: 'rem', label: 'REM', ms: last.remMs },
        { key: 'light', label: 'Leicht', ms: last.lightMs },
        { key: 'awake', label: 'Wach', ms: last.awakeMs }
      ]
    : []
  const needTotal = last?.need
    ? last.need.baselineMs + last.need.debtMs + last.need.strainMs + last.need.napMs
    : null
  const yesterday = days[1] ?? null

  return (
    <PageSection title="Schlaf" icon={MoonIcon} note="WHOOP · alle 10 Min.">
      <div className="bento">
        {/* Der eine Satz für heute */}
        {coaching?.focus && (
          <article className="card bento__full sl-focus">
            <span className="sl-focus__label">Heute besser als gestern</span>
            <p className="sl-focus__text">{coaching.focus}</p>
          </article>
        )}

        {/* Kennzahl-Kacheln wählen den Chart */}
        <div className="tiles sl-tiles bento__full">
          {METRICS.map((x) => {
            const v = days.map(x.pick).find((n) => n != null)
            return (
              <button
                key={x.key}
                className={`tile ${x.key === metric ? 'is-active' : ''}`}
                onClick={() => setMetric(x.key)}
                aria-pressed={x.key === metric}
              >
                <div className="tile__label">{x.label}</div>
                <div className="tile__value">
                  <CountUp value={v} format={x.format} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Verlauf */}
        <article className="card bento__full">
          <div className="hero__top">
            <div>
              <div className="hero__name">{m.label}</div>
              <div className="hero__value">
                <span className="hero__price">
                  {/* key: Andere Kennzahl, andere Einheit – neu ab 0 zählen. */}
                  <CountUp key={metric} value={latest} format={m.format} />
                </span>
                {latest != null && before != null && (
                  <span className={`delta ${latest >= before ? 'up' : 'down'}`}>{m.delta(latest, before)}</span>
                )}
              </div>
            </div>
            <div className="seg" role="group" aria-label="Zeitraum">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  className={r.key === rangeKey ? 'is-active' : ''}
                  onClick={() => setRangeKey(r.key)}
                  aria-pressed={r.key === rangeKey}
                >
                  {r.key}
                </button>
              ))}
            </div>
          </div>
          <SleepChart data={series} format={m.format} axis={m.axis} />
        </article>

        {/* Letzte Nacht im Detail */}
        {last && (
          <article className="card bento__wide">
            <div className="card__head">
              <h3 className="card__title">Letzte Nacht</h3>
              <span className="sec__note">
                {time(last.bedtime)}–{time(last.wake)}
              </span>
            </div>
            <div className="sl-stages" role="img" aria-label="Schlafphasen">
              {stages.map((s) => (
                <span
                  key={s.key}
                  className={`sl-stages__seg is-${s.key}`}
                  style={{ flexGrow: s.ms / stageTotal }}
                />
              ))}
            </div>
            <ul className="sl-legend">
              {stages.map((s) => (
                <li key={s.key}>
                  <span className={`sl-legend__dot is-${s.key}`} />
                  <span className="sl-legend__label">{s.label}</span>
                  <span className="sl-legend__value">{dur(s.ms)}</span>
                </li>
              ))}
            </ul>
            <dl className="sl-facts">
              <div>
                <dt>Geschlafen</dt>
                <dd>{dur(last.durationMs)}</dd>
              </div>
              <div>
                <dt>Bedarf</dt>
                <dd>{needTotal ? dur(needTotal) : '–'}</dd>
              </div>
              <div>
                <dt>Effizienz</dt>
                <dd>{last.efficiency != null ? pct(last.efficiency) : '–'}</dd>
              </div>
              <div>
                <dt>Konstanz</dt>
                <dd>{last.consistency != null ? pct(last.consistency) : '–'}</dd>
              </div>
              <div>
                <dt>Aufwacher</dt>
                <dd>{last.disturbances}</dd>
              </div>
              <div>
                <dt>Atemfrequenz</dt>
                <dd>{last.respiratoryRate != null ? last.respiratoryRate.toFixed(1).replace('.', ',') : '–'}</dd>
              </div>
            </dl>
          </article>
        )}

        {/* Gestern: Belastung und Training */}
        <article className="card">
          <div className="card__head">
            <h3 className="card__title">Gestern</h3>
          </div>
          <div className="stat">
            <div className="stat__value">
              <CountUp value={yesterday?.strain} format={(v) => v.toFixed(1).replace('.', ',')} />
            </div>
            <div className="stat__label">Strain</div>
          </div>
          <div className="stat">
            <div className="stat__value">
              <CountUp value={yesterday?.steps} />
            </div>
            <div className="stat__label">Schritte</div>
          </div>
          {data.workoutsAvailable ? (
            <ul className="rows sl-workouts">
              {(yesterday?.workouts ?? []).length === 0 ? (
                <li className="row">
                  <div className="row__meta">Kein Training erfasst.</div>
                </li>
              ) : (
                yesterday!.workouts.map((w) => (
                  <li className="row" key={w.start}>
                    <div className="row__main">
                      <div className="row__title">{w.sport}</div>
                      <div className="row__meta">
                        {time(w.start)}
                        {w.avgHr ? ` · ⌀ ${w.avgHr} bpm` : ''}
                      </div>
                    </div>
                    {w.strain != null && <span className="cd">{w.strain.toFixed(1).replace('.', ',')}</span>}
                  </li>
                ))
              )}
            </ul>
          ) : (
            <p className="sl-hint">Für Trainings einmal neu koppeln (unten).</p>
          )}
        </article>

        {/* Empfehlungen */}
        <article className="card bento__full">
          <div className="card__head">
            <h3 className="card__title">Empfehlungen für heute</h3>
            {coaching?.plan && <span className="sec__note">Ziel: {dur(coaching.plan.sleepTargetMs)} Schlaf</span>}
          </div>
          {coaching?.recommendations.length ? (
            <ul className="sl-recs">
              {coaching.recommendations.map((r) => (
                <li key={r.id} className="sl-rec">
                  <span className={`sl-rec__kind is-${r.kind}`}>{KIND_LABEL[r.kind]}</span>
                  <div className="sl-rec__main">
                    <p className="sl-rec__title">{r.title}</p>
                    <p className="sl-rec__detail">{r.detail}</p>
                    <p className="sl-rec__basis">{r.basis}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="state">Noch keine Daten für heute.</div>
          )}
          <p className="sl-disclaimer">Abgeleitet aus deinen WHOOP-Werten und dem Kalender – keine medizinische Beratung.</p>
        </article>

        {!data.workoutsAvailable && (
          <article className="card bento__full">
            <div className="card__head">
              <h3 className="card__title">Trainings freischalten</h3>
            </div>
            <WhoopConnect onDone={reload} />
          </article>
        )}
      </div>
    </PageSection>
  )
}
