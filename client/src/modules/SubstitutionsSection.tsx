import PageSection from '../components/PageSection.tsx'
import NotConnected from '../components/NotConnected.tsx'
import { SchoolIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import type { SubstitutionEntry, SubstitutionPlan } from '../types.ts'

// Alle 10 Minuten nachladen – serverseitig ist der Plan ohnehin so lange
// gecacht, häufiger abzufragen belastet nur das Schulportal.
const REFRESH_MS = 10 * 60 * 1000

// Reihenfolge und Beschriftung der Felder. Was das Portal sonst noch liefert,
// hängen wir hinten an, statt es zu verschlucken.
const FIELDS: [keyof SubstitutionEntry, string][] = [
  ['subject', 'Fach'],
  ['substitute', 'Vertretung'],
  ['teacher', 'Lehrkraft'],
  ['room', 'Raum'],
  ['className', 'Klasse'],
  ['kind', 'Art']
]

const KNOWN = new Set([...FIELDS.map(([k]) => k as string), 'lesson', 'note'])

// „fällt aus" ist die Information, die man auf einen Blick sehen will.
const isCancelled = (entry: SubstitutionEntry) =>
  /f[äa]llt aus|entfällt|entfaellt/i.test(`${entry.note ?? ''} ${entry.kind ?? ''}`)

function Entry({ entry }: { entry: SubstitutionEntry }) {
  const extra = Object.entries(entry).filter(([key, value]) => value && !KNOWN.has(key))

  return (
    <li className="vp">
      <span className={`vp__lesson num ${isCancelled(entry) ? 'is-out' : ''}`}>
        {entry.lesson ?? '–'}
      </span>
      <div className="vp__body">
        <div className="vp__facts">
          {FIELDS.filter(([key]) => entry[key]).map(([key, label]) => (
            <span className="vp__fact" key={String(key)}>
              <span className="vp__fact-label">{label}</span>
              <span className="vp__fact-value">{entry[key]}</span>
            </span>
          ))}
          {extra.map(([key, value]) => (
            <span className="vp__fact" key={key}>
              <span className="vp__fact-label">{key}</span>
              <span className="vp__fact-value">{value}</span>
            </span>
          ))}
        </div>
        {entry.note && (
          <div className={`vp__note ${isCancelled(entry) ? 'is-out' : ''}`}>{entry.note}</div>
        )}
      </div>
    </li>
  )
}

export default function SubstitutionsSection() {
  const { data, loading, error, reload } = useApi<SubstitutionPlan>('/api/substitutions', REFRESH_MS)

  if (!loading && data && !data.configured) {
    return (
      <PageSection title="Vertretungsplan" icon={SchoolIcon}>
        <NotConnected
          name="Schulportal Hessen"
          steps={[
            'Schul-ID suchen: /api/substitutions/schools?q=schulname',
            'Benutzername ist Vorname.Nachname – ohne die Schul-ID davor.',
            'Werte in die .env eintragen und den Container neu starten.'
          ]}
          envVars={['SPH_SCHOOL_ID', 'SPH_USERNAME', 'SPH_PASSWORD']}
        />
      </PageSection>
    )
  }

  const stand = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <PageSection
      title="Vertretungsplan"
      icon={SchoolIcon}
      note={data?.who ?? (stand ? `Stand ${stand}` : undefined)}
    >
      <div className="card">
        {loading && !data ? (
          <div className="state">Lädt …</div>
        ) : error || data?.error ? (
          <div className="state">
            {data?.error ?? 'Plan gerade nicht abrufbar.'}
            <button className="retry" onClick={reload}>
              Erneut versuchen
            </button>
          </div>
        ) : data?.state === 'unknown' ? (
          // Wichtig sichtbar zu machen: hier ist der Plan nicht leer, sondern
          // unlesbar. Sonst verlässt man sich auf eine Stille, die nichts heißt.
          <div className="state">
            Der Plan konnte nicht gelesen werden – das Portal hat vermutlich sein
            Layout geändert. Bitte melden, dann wird der Parser nachgezogen.
          </div>
        ) : !data?.days.length ? (
          // Auf days prüfen, nicht auf total: Ein Tag ohne Vertretung, aber mit
          // "Unterrichtsfrei, 6 Std." ist alles andere als nichts.
          <div className="state">Keine Vertretungen gemeldet.</div>
        ) : (
          data.days.map((day) => (
            <div className="vpday" key={day.label}>
              <h3 className="vpday__head">
                {day.label}
                {day.week && <span className="vpday__week">{day.week}</span>}
              </h3>

              {day.infos.length > 0 && (
                <ul className="vpinfos">
                  {day.infos.map((info, i) => (
                    <li className="vpinfo" key={i}>
                      {info.title && <span className="vpinfo__title">{info.title}</span>}
                      <span className="vpinfo__lines">{info.lines.join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}

              {day.entries.length > 0 && (
                <ul className="rows">
                  {day.entries.map((entry, i) => (
                    <Entry entry={entry} key={i} />
                  ))}
                </ul>
              )}
            </div>
          ))
        )}

        <p className="todohint">
          Persönlicher Plan aus dem Schulportal Hessen{stand ? ` · Stand ${stand}` : ''}.
        </p>
      </div>
    </PageSection>
  )
}
