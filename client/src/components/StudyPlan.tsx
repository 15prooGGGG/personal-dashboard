import { useEffect, useMemo, useState } from 'react'
import type { DayPlanData, PlanDay } from './DayPlan.tsx'

// ===========================================================================
// Lernplan unter dem Stapel: links die Klausuren mit Themen-Fortschritt
// (Checklisten-Notiz je Klausur im Vault), rechts die Woche mit den
// automatisch verteilten Lernblöcken. Klick auf einen Block streicht ihn –
// die Zeit rutscht dann in die nächste freie Lücke. Gerechnet wird alles in
// server/study-plan.js (/api/studyplan).
// ===========================================================================

export interface StudyExam {
  id: string
  subject: string
  short: string
  kind: string
  level: 'LK' | 'GK'
  date: string
  inDays: number
  note: string
  noteExists: boolean
  topics: { text: string; done: boolean }[]
  topicsDue: string
  topicsLate: boolean
  budgetMin: number
  doneMin: number
  plannedMin: number
  missingMin: number
}
export interface StudyBlock {
  id: string
  examId: string
  date: string
  start: string
  end: string
  title: string
  topic?: string
  past: boolean
}
export interface StudyPlanData {
  today: string
  horizon: string[]
  exams: StudyExam[]
  blocks: StudyBlock[]
  skipped: { date: string; start: string; end: string }[]
}

const VAULT_NAME = 'Second-Brain'
const COLORS = ['accent', 'good', 'amber', 'down']
const START = 8 * 60
const END = 22 * 60
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const pct = (m: number) => `${((Math.min(Math.max(m, START), END) - START) / (END - START)) * 100}%`
const ddmm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`
const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')
const hours = (min: number) => (min / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })
const obsidianUrl = (note: string) =>
  `obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(note.replace(/\.md$/, ''))}`

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** Feste Termine eines Tages für das Wochenraster (Schule zusammengefasst). */
function fixedBlocks(day: PlanDay) {
  const out: { kind: string; title: string; start: number; end: number }[] = []
  for (const b of day.blocks) {
    if (b.kind === 'school' || b.kind === 'break') {
      const last = out[out.length - 1]
      if (last?.kind === 'school' && b.start - last.end <= 20) last.end = Math.max(last.end, b.end)
      else if (b.kind === 'school') out.push({ kind: 'school', title: 'Schule', start: b.start, end: b.end })
    } else if (b.kind === 'gym' || b.kind === 'event' || b.kind === 'work') {
      out.push({ kind: b.kind === 'gym' ? 'gym' : 'event', title: b.title, start: b.start, end: b.end })
    }
  }
  return out
}

export default function StudyPlan({
  data,
  loading,
  dayPlan,
  onChange
}: {
  data: StudyPlanData | null
  loading: boolean
  dayPlan: DayPlanData | null
  onChange: () => void
}) {
  const [sel, setSel] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [topics, setTopics] = useState<Record<string, StudyExam['topics']>>({})
  useEffect(() => {
    setTopics({})
    setBusy(null)
  }, [data])

  const exams = data?.exams ?? []
  const colorOf = useMemo(() => {
    const m = new Map<string, string>()
    exams.slice(0, COLORS.length).forEach((e, i) => m.set(e.id, COLORS[i]))
    return (id: string) => m.get(id) ?? 'muted'
  }, [exams])

  if (!data) {
    return (
      <section className="lp" aria-label="Lernplan">
        <h2 className="dr-title">Lernplan</h2>
        <div className="sx-meta">{loading ? 'Lädt …' : 'Lernplan gerade nicht verfügbar.'}</div>
      </section>
    )
  }
  if (!exams.length) {
    return (
      <section className="lp" aria-label="Lernplan">
        <h2 className="dr-title">Lernplan</h2>
        <div className="sx-meta">Keine Klausuren im Klausurplan.</div>
      </section>
    )
  }

  const current = exams.find((e) => e.id === sel) ?? exams[0]
  const topicsOf = (e: StudyExam) => topics[e.id] ?? e.topics
  const visible = showAll ? exams : exams.slice(0, 4)
  const week = data.horizon.slice(0, 7)
  const skipped = data.skipped.map((s) => ({ ...s, id: `${s.date}T${s.start}` }))
  const live = data.blocks.filter((b) => week.includes(b.date))
  const liveMin = live.filter((b) => !b.past).reduce((a, b) => a + toMin(b.end) - toMin(b.start), 0)
  const examOn = (d: string) => exams.find((e) => e.date === d)

  const toggleTopic = async (e: StudyExam, index: number, done: boolean) => {
    const list = topicsOf(e).map((t, i) => (i === index ? { ...t, done } : t))
    setTopics((t) => ({ ...t, [e.id]: list }))
    const res = await post('/api/studyplan/topic', { examId: e.id, index, done })
    if (res.ok) onChange()
    else setTopics((t) => ({ ...t, [e.id]: e.topics }))
  }
  const toggleBlock = async (b: { id: string; date: string; start: string; end: string }, skip: boolean) => {
    setBusy(b.id)
    await post('/api/studyplan/skip', { date: b.date, start: b.start, end: b.end, skip })
    onChange()
  }
  const chip = (e: StudyExam) => {
    const list = topicsOf(e)
    if (list.length) return <span className="lp-chip is-ok">{list.filter((t) => t.done).length}/{list.length} Themen</span>
    if (e.topicsLate) return <span className="lp-chip is-warn">Themen fehlen · seit {ddmm(e.topicsDue)}</span>
    return <span className="lp-chip">Themen bis {ddmm(e.topicsDue)}</span>
  }

  return (
    <section className="lp" aria-label="Lernplan">
      <div className="lp-head">
        <h2 className="dr-title">Lernplan</h2>
        <div className="lp-sum">
          Diese Woche <b>{live.filter((b) => !b.past).length}</b> Blöcke · <b>{hours(liveMin)}</b> Std · nächste Klausur{' '}
          {exams[0].short} in <b>{exams[0].inDays}</b> {exams[0].inDays === 1 ? 'Tag' : 'Tagen'}
        </div>
      </div>

      <div className="lp-grid">
        <div className="lp-left">
          <div className="lp-exams">
            {visible.map((e) => {
              const list = topicsOf(e)
              const done = list.filter((t) => t.done).length
              return (
                <button
                  key={e.id}
                  type="button"
                  className="lp-ex"
                  aria-pressed={e.id === current.id}
                  style={{ ['--c' as string]: `var(--${colorOf(e.id)})` }}
                  onClick={() => setSel(e.id)}
                >
                  <span className="lp-cd">
                    {e.inDays}
                    <small>{e.inDays === 1 ? 'Tag' : 'Tage'}</small>
                  </span>
                  <span className="lp-ex__body">
                    <span className="lp-ex__t">
                      <i />
                      {e.subject} <span className="lp-ex__k">{e.kind}</span>
                    </span>
                    <span className="lp-ex__m">
                      {weekday(e.date)} {ddmm(e.date)}
                      {e.doneMin + e.plannedMin > 0 && ` · ${hours(e.doneMin + e.plannedMin)} von ${hours(e.budgetMin)} Std geplant`}
                    </span>
                    {list.length > 0 && (
                      <span className="lp-bar">
                        <i style={{ width: `${(done / list.length) * 100}%` }} />
                      </span>
                    )}
                    <span className="lp-chips">
                      {chip(e)}
                      {e.missingMin > 0 && <span className="lp-chip is-warn">{hours(e.missingMin)} Std fehlen</span>}
                    </span>
                  </span>
                </button>
              )
            })}
            {exams.length > 4 && (
              <button type="button" className="lp-more" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Weniger zeigen' : `+ ${exams.length - 4} weitere bis ${ddmm(exams[exams.length - 1].date)}`}
              </button>
            )}
          </div>

          <div className="lp-detail">
            <h3>
              {current.subject} {current.kind}
            </h3>
            {topicsOf(current).length ? (
              <>
                <p>Aus der Notiz „{current.note.split('/').pop()?.replace(/\.md$/, '')}“. Abhaken hier oder in Obsidian, beides bleibt gleich.</p>
                <div className="lp-todos">
                  {topicsOf(current).map((t, i) => (
                    <label key={`${current.id}-${i}`} className={`lp-todo${t.done ? ' is-done' : ''}`}>
                      <input
                        id={`lp-${current.id}-${i}`}
                        type="checkbox"
                        checked={t.done}
                        onChange={(ev) => toggleTopic(current, i, ev.target.checked)}
                      />
                      <span>{t.text}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p>
                {current.noteExists
                  ? `Noch keine Themen. Die Notiz liegt in Obsidian unter Schule & Abitur › Lernpläne. Trag die Themen dort als Checkliste ein oder schick Claude ein Foto vom Themenzettel.`
                  : `Die Notiz wird ${current.inDays > 28 ? '4 Wochen vor der Klausur' : 'gleich'} angelegt. Themen bis ${ddmm(current.topicsDue)} eintragen.`}
              </p>
            )}
            {current.noteExists && (
              <div className="lp-actions">
                <a className="lp-btn is-primary" href={obsidianUrl(current.note)}>
                  In Obsidian öffnen
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="lp-right">
          <div className="lp-week-scroll">
            <div className="lp-week">
              <div />
              {week.map((d) => (
                <div key={d} className={`lp-dh${examOn(d) ? ' is-exam' : ''}`}>
                  {d === data.today ? 'Heute' : weekday(d)}
                  <b>{Number(d.slice(8))}</b>
                </div>
              ))}
              <div className="lp-hours">
                {[8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                  <span key={h} style={{ top: pct(h * 60) }}>
                    {h}
                  </span>
                ))}
              </div>
              {week.map((d) => {
                const day = dayPlan?.days.find((x) => x.date === d)
                const exam = examOn(d)
                return (
                  <div key={d} className="lp-col">
                    {[10, 12, 14, 16, 18, 20].map((h) => (
                      <div key={h} className="lp-hl" style={{ top: pct(h * 60) }} />
                    ))}
                    {day &&
                      fixedBlocks(day).map((b, i) => (
                        <div
                          key={i}
                          className={`lp-blk is-${b.kind}`}
                          style={{ top: pct(b.start), height: `calc(${pct(b.end)} - ${pct(b.start)} - 2px)` }}
                          title={b.title}
                        >
                          {b.end - b.start >= 50 ? b.title : ''}
                        </div>
                      ))}
                    {exam && <div className="lp-examtag">Klausur {exam.short}</div>}
                    {data.blocks
                      .filter((b) => b.date === d)
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={`lp-blk lp-study${b.past ? ' is-past' : ''}`}
                          style={{
                            top: pct(toMin(b.start)),
                            height: `calc(${pct(toMin(b.end))} - ${pct(toMin(b.start))} - 2px)`,
                            ['--c' as string]: `var(--${colorOf(b.examId)})`
                          }}
                          disabled={b.past || busy === b.id}
                          onClick={() => toggleBlock(b, true)}
                          aria-label={`${b.title}, ${b.start} bis ${b.end}${b.past ? '' : '. Streichen'}`}
                          title={b.past ? b.title : `${b.title} – klicken zum Streichen`}
                        >
                          {b.title.split(':')[0]}
                          <small>
                            {b.start}–{b.end}
                            {b.topic ? ` · ${b.topic}` : ''}
                          </small>
                        </button>
                      ))}
                    {skipped
                      .filter((s) => s.date === d)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="lp-blk lp-study is-off"
                          style={{ top: pct(toMin(s.start)), height: `calc(${pct(toMin(s.end))} - ${pct(toMin(s.start))} - 2px)` }}
                          disabled={busy === s.id}
                          onClick={() => toggleBlock(s, false)}
                          aria-label={`Gestrichen ${s.start} bis ${s.end}. Zurückholen`}
                          title="Gestrichen – klicken zum Zurückholen"
                        >
                          <small>
                            {s.start}–{s.end}
                          </small>
                        </button>
                      ))}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="lp-legend">
            {exams.slice(0, COLORS.length).filter((e) => data.blocks.some((b) => b.examId === e.id && week.includes(b.date))).map((e) => (
              <span key={e.id}>
                <i className="is-study" style={{ ['--c' as string]: `var(--${colorOf(e.id)})` }} />
                {e.short}
              </span>
            ))}
            <span>
              <i className="is-school" />
              Schule
            </span>
            <span>
              <i className="is-gym" />
              Gym / Termine
            </span>
            <span>Klick auf einen Block: streichen, die Zeit rutscht in die nächste Lücke</span>
          </div>
          <p className="lp-rules">
            LK ≈ 8 Std in den 10 Tagen vor der Klausur, GK ≈ 4 Std in 7 Tagen. Blöcke bis 2 Std, höchstens 2 am Tag, nur in freie Lücken
            (Freistunden zählen), nie über Gym, Termine oder die Schlafenszeit. Am Abend vorher nur kurz wiederholen.
          </p>
        </div>
      </div>
    </section>
  )
}
