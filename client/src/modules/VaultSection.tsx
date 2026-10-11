import { useState } from 'react'
import PageSection from '../components/PageSection.tsx'
import { VaultIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'

// Auf dem Handy (hochkant) ist die Liste sonst endlos – erst ein Auszug,
// den Rest auf Knopfdruck.
const TASK_PREVIEW = 8

interface VaultProject {
  title: string
  path: string
  status: string | null
  tags: string[]
  created: string | null
  openTasks: number
  doneTasks: number
}
interface VaultTask {
  text: string
  note: string
  folder: string
}
interface VaultResponse {
  configured: boolean
  reason?: string
  counts?: { notes: number; projects: number; openTasks: number }
  projects?: VaultProject[]
  tasks?: VaultTask[]
  recent?: { title: string; folder: string; modified: string }[]
}

export default function VaultSection() {
  const { data, loading, error } = useApi<VaultResponse>('/api/vault', 5 * 60 * 1000)
  const [allTasks, setAllTasks] = useState(false)

  if (loading) {
    return (
      <PageSection title="Second Brain" icon={VaultIcon}>
        <div className="state">Lädt …</div>
      </PageSection>
    )
  }

  if (error || !data) {
    return (
      <PageSection title="Second Brain" icon={VaultIcon}>
        <div className="state">{error ?? 'Nicht verfügbar.'}</div>
      </PageSection>
    )
  }

  if (!data.configured) {
    return (
      <PageSection title="Second Brain" icon={VaultIcon}>
        <div className="setup">
          <p className="setup__lead">
            {data.reason === 'empty'
              ? 'Der Vault-Ordner ist noch leer.'
              : 'Der Vault-Ordner ist auf dem Server nicht vorhanden.'}
          </p>
          <p className="muted">
            Syncthing synchronisiert deinen Obsidian-Vault vom Mac auf den Server. Prüfe in der
            Syncthing-Oberfläche, ob der Ordner <code>Second-Brain</code> auf „Aktuell" steht.
          </p>
        </div>
      </PageSection>
    )
  }

  const { counts, projects = [], tasks = [] } = data
  const shownTasks = allTasks ? tasks : tasks.slice(0, TASK_PREVIEW)

  return (
    <PageSection
      title="Second Brain"
      icon={VaultIcon}
      note={`${counts?.notes ?? 0} Notizen · aus Obsidian`}
    >
      <div className="bento">
        {/* Offene Aufgaben aus allen Notizen */}
        <article className="card vt-card bento__wide">
          <div className="card__head">
            <h3 className="card__title">Offene Aufgaben</h3>
            <span className="sec__note">{counts?.openTasks ?? tasks.length} gesamt</span>
          </div>
          {tasks.length === 0 ? (
            <div className="state">Keine offenen Aufgaben im Vault.</div>
          ) : (
            <>
              <ul className="rows">
                {shownTasks.map((t, i) => (
                  <li className="vt" key={`${t.note}-${i}`}>
                    <span className="vt__dot" aria-hidden />
                    <div className="vt__main">
                      <p className="vt__text">{t.text}</p>
                      <p className="vt__note">{t.note}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {tasks.length > TASK_PREVIEW && (
                <button
                  type="button"
                  className="vt__more"
                  onClick={() => setAllTasks((v) => !v)}
                  aria-expanded={allTasks}
                >
                  {allTasks ? 'Weniger anzeigen' : `Alle ${tasks.length} anzeigen`}
                </button>
              )}
            </>
          )}
        </article>

        {/* Projekte mit Fortschritt */}
        <article className="card vt-card">
          <div className="card__head">
            <h3 className="card__title">Projekte</h3>
            <span className="sec__note">{projects.length}</span>
          </div>
          {projects.length === 0 ? (
            <div className="state">Keine Projekte gefunden.</div>
          ) : (
            <ul className="rows">
              {projects.map((p) => (
                <li className="vt-proj" key={p.path}>
                  <div className="vt-proj__main">
                    <p className="vt-proj__title">{p.title}</p>
                    {/* "aktiv" ist der Normalfall – nur Abweichungen zeigen. */}
                    {p.status && p.status.toLowerCase() !== 'aktiv' && (
                      <p className="vt-proj__meta">{p.status}</p>
                    )}
                  </div>
                  <span className={`cd ${p.openTasks > 0 ? 'is-soon' : ''}`}>
                    {p.openTasks} offen
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </PageSection>
  )
}
