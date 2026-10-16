import { useRef, useState } from 'react'
import DayRuler from './DayRuler.tsx'
import type { RulerBlock, RulerKind } from './DayRuler.tsx'

// ===========================================================================
// Tagesplan oben auf der Startseite: Tage zum Umschalten, die drei Eckdaten
// (aufstehen, Schule, ins Bett), der Tagesregler und darunter Empfehlungen
// (Entfall, früher Schluss) und Warner, wenn ein Termin die Routine sprengt.
// Alles kommt fertig gerechnet aus /api/dayplan (server/day-plan.js).
// ===========================================================================

export interface PlanBlock {
  kind: RulerKind
  title: string
  start: number
  end: number
  startTime: string
  endTime: string
  info?: string
}
export interface PlanNote {
  kind: 'sleep-in' | 'study-early' | 'early-end' | 'no-school' | 'gap' | 'shift'
  title: string
  detail: string
}
export interface PlanWarning {
  date: string
  label: string
  inDays: number
  level: 'soon' | 'ahead'
  text: string
  with: string
  event: string
}
export interface PlanDay {
  date: string
  label: string
  weekday: string
  inDays: number
  week: string | null
  schoolDay: boolean
  breakName: string | null
  wake: { time: string; min: number; why: string }
  bedtime: { time: string; min: number; sleepTargetMs: number; expectedSleepMs: number; nextWake: string }
  school: { start: string; end: string; regularStart: string; regularEnd: string } | null
  blocks: PlanBlock[]
  chips: { kind: string; title: string }[]
  notes: PlanNote[]
  warnings: PlanWarning[]
}
export interface AiAdvice {
  mode: 'evening' | 'morning'
  forDate: string
  headline: string
  decision: string
  wake: string | null
  bedtime: string | null
  reasoning: string
  actions: string[]
  confidence: 'hoch' | 'mittel' | 'niedrig'
  corrected?: string
  createdAt: string
}
export interface DayPlanData {
  today: string
  days: PlanDay[]
  warnings: PlanWarning[]
  ignoredFamilyEvents: number
  ai?: { configured: boolean; morning: AiAdvice | null; evening: AiAdvice | null }
}

const hm = (ms: number) => {
  const min = Math.round(ms / 60000)
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}`
}
const shortDay = (d: PlanDay) =>
  d.inDays === 0 ? 'Heute' : d.inDays === 1 ? 'Morgen' : `${d.weekday.slice(0, 2)} ${Number(d.date.slice(8))}.`

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/** Claudes Einschätzung für den gewählten Tag – mit Knopf zum Neu-Fragen. */
function AiCoach({ day, ai, onReload }: { day: PlanDay; ai: NonNullable<DayPlanData['ai']>; onReload: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Heute: Morgenrunde vor Abendrunde; morgen: die Abendrunde von heute.
  const advice =
    day.inDays === 0
      ? (ai.morning?.forDate === day.date ? ai.morning : null) ?? (ai.evening?.forDate === day.date ? ai.evening : null)
      : day.inDays === 1 && ai.evening?.forDate === day.date
        ? ai.evening
        : null
  if (day.inDays > 1) return null
  if (!ai.configured) {
    return <p className="dp-ai-off">Claude-Coach ist aus – dafür ANTHROPIC_API_KEY in der .env eintragen.</p>
  }
  const ask = async () => {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/dayplan/ai?mode=${day.inDays === 0 ? 'morning' : 'evening'}`, { method: 'POST' })
      if (!res.ok) setErr(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Claude gerade nicht erreichbar.')
      onReload()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="dp-ai" aria-live="polite">
      <div className="dp-ai__top">
        <span className="dp-ai__lab">Claude</span>
        {advice && (
          <span className="dp-ai__meta">
            {advice.mode === 'evening' ? 'Abendrunde' : 'Morgenrunde'} · {timeOf(advice.createdAt)} · Sicherheit {advice.confidence}
          </span>
        )}
        <button className="dr-now" onClick={ask} disabled={busy}>
          {busy ? 'Denkt nach …' : advice ? 'Neu fragen' : 'Claude fragen'}
        </button>
      </div>
      {advice ? (
        <>
          <p className="dp-ai__head">{advice.headline}</p>
          {(advice.wake || advice.bedtime) && (
            <p className="dp-ai__times">
              {advice.wake && (
                <span>
                  <b>{advice.wake}</b> Wecker{advice.wake !== day.wake.time ? ` (Plan: ${day.wake.time})` : ''}
                </span>
              )}
              {advice.bedtime && (
                <span>
                  <b>{advice.bedtime}</b> ins Bett
                </span>
              )}
            </p>
          )}
          <p className="dp-ai__why">{advice.reasoning}</p>
          {advice.actions.length > 0 && (
            <ul className="dp-ai__acts">
              {advice.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          {advice.corrected && <p className="dp-ai__why">{advice.corrected}</p>}
        </>
      ) : (
        <p className="dp-ai__why">
          {day.inDays === 0 ? 'Die Morgenrunde kommt, sobald WHOOP deine Nacht gewertet hat.' : 'Die Abendrunde kommt um 20:30 – oder jetzt per Knopf.'}
        </p>
      )}
      {err && <p className="dp-ai__why is-err">{err}</p>}
    </div>
  )
}

export default function DayPlan({ data, loading, onReload }: { data: DayPlanData | null; loading: boolean; onReload: () => void }) {
  const [sel, setSel] = useState(0)
  const home = useRef<(() => void) | null>(null)
  const days = data?.days ?? []
  const day = days[Math.min(sel, days.length - 1)]

  if (!day) {
    return (
      <section className="dp" aria-label="Tagesplan">
        <h2 className="dr-title">Dein Tag</h2>
        <div className="sx-meta">{loading ? 'Lädt …' : 'Tagesplan gerade nicht verfügbar.'}</div>
      </section>
    )
  }

  const clashing = new Set(day.warnings.map((w) => w.event))
  const blocks: RulerBlock[] = day.blocks.map((b) => ({
    start: b.start,
    end: b.end,
    name: b.title,
    kind: b.kind,
    info: b.info ?? `${b.startTime}–${b.endTime}`,
    clash: clashing.has(b.title) && (b.kind === 'event' || b.kind === 'gym' || b.kind === 'work')
  }))
  // Warner der anderen Tage: der Grund, warum der Plan Tage im Voraus zeigt.
  const ahead = (data?.warnings ?? []).filter((w) => w.date !== day.date).slice(0, 3)
  const title = day.inDays === 0 ? 'Dein Tag' : day.inDays === 1 ? 'Dein Morgen' : `Dein ${day.weekday}`

  return (
    <section className="dp" aria-label="Tagesplan">
      <div className="dp-head">
        <h2 className="dr-title">{title}</h2>
        <div className="dp-days" role="tablist" aria-label="Tag wählen">
          {days.map((d, i) => (
            <button
              key={d.date}
              role="tab"
              aria-selected={i === sel}
              className={`dp-day ${i === sel ? 'is-on' : ''} ${d.schoolDay ? '' : 'is-off'}`}
              onClick={() => setSel(i)}
            >
              {shortDay(d)}
              {d.warnings.length > 0 && <i className={`dp-dot is-${d.warnings[0].level}`} aria-label="Warnung" />}
            </button>
          ))}
        </div>
      </div>

      <div className="dp-facts">
        <span className="dp-fact">
          <b>{day.wake.time}</b> aufstehen
        </span>
        <span className="dp-fact">
          {day.school ? (
            <>
              <b>
                {day.school.start}–{day.school.end}
              </b>{' '}
              Schule{day.week ? ` · ${day.week}-Woche` : ''}
            </>
          ) : (
            <>
              <b>Frei</b> {day.breakName ?? (day.weekday === 'Samstag' || day.weekday === 'Sonntag' ? 'Wochenende' : '')}
            </>
          )}
        </span>
        <span className="dp-fact">
          <b>{day.bedtime.time}</b> ins Bett · Ziel {hm(day.bedtime.sleepTargetMs)}
        </span>
        {day.chips.map((c) => (
          <span key={c.title} className={`sx-tag ${c.kind === 'exam' ? 'is-down' : ''}`}>
            {c.title}
          </span>
        ))}
        <button className="dr-now" onClick={() => home.current?.()}>
          {day.inDays === 0 ? 'Jetzt' : 'Aufstehen'}
        </button>
      </div>

      {data?.ai && <AiCoach day={day} ai={data.ai} onReload={onReload} />}

      <DayRuler blocks={blocks} bedtime={day.bedtime.min} isToday={day.inDays === 0} startAt={day.wake.min} homeRef={home} />

      {(day.warnings.length > 0 || day.notes.length > 0 || ahead.length > 0) && (
        <ul className="dp-list">
          {day.warnings.map((w) => (
            <li key={w.text} className="dp-item is-warn">
              <i />
              <span>{w.text}</span>
            </li>
          ))}
          {day.notes.map((n) => (
            <li key={n.title} className={`dp-item is-${n.kind}`}>
              <i />
              <span>
                <b>{n.title}</b> {n.detail}
              </span>
            </li>
          ))}
          {ahead.map((w) => (
            <li key={`${w.date}-${w.text}`} className="dp-item is-ahead">
              <i />
              <button onClick={() => setSel(days.findIndex((d) => d.date === w.date))}>
                <b>{w.inDays === 1 ? 'Morgen' : `${days.find((d) => d.date === w.date)?.weekday ?? w.label}`}:</b> {w.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
