import PageSection from '../components/PageSection.tsx'
import { VaultIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'

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

  return (
    <PageSection
      title="Second Brain"
      icon={VaultIcon}
      note={`${counts?.notes ?? 0} Notizen · aus Obsidian`}
    >
      <div className="bento">
        {/* Offene Aufgaben aus allen Notizen */}
        <article className="card bento__wide">
          <div className="card__head">
            <h3 className="card__title">Offene Aufgaben</h3>
            <span className="sec__note">{counts?.openTasks ?? 0} gesamt</span>
          </div>
          {tasks.length === 0 ? (
            <div className="state">Keine offenen Aufgaben im Vault.</div>
          ) : (
            <ul className="rows">
              {tasks.map((t, i) => (
                <li className="row" key={`${t.note}-${i}`}>
                  <span className="todo__check" aria-hidden />
                  <div className="row__main">
                    <div className="row__title">{t.text}</div>
                    <div className="row__meta">{t.note}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Projekte mit Fortschritt */}
        <article className="card">
          <div className="card__head">
            <h3 className="card__title">Projekte</h3>
            <span className="sec__note">{projects.length}</span>
          </div>
          {projects.length === 0 ? (
            <div className="state">Keine Projekte gefunden.</div>
          ) : (
            <ul className="rows">
              {projects.map((p) => (
                <li className="row" key={p.path}>
                  <div className="row__main">
                    <div className="row__title">{p.title}</div>
                    {p.status && <div className="row__meta">{p.status}</div>}
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
