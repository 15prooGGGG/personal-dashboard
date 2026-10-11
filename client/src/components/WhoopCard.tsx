import { useEffect, useState } from 'react'
import { useApi } from '../lib/useApi.ts'

interface WhoopData {
  configured: boolean
  connected: boolean
  recovery?: { score: number; hrv: number; restingHr: number } | null
  strain?: number | null
  sleep?: { performance: number; durationMs: number | null } | null
}

// WHOOP-Farblogik für Recovery (grün ≥ 67, gelb 34–66, rot ≤ 33), übertragen
// auf die Dashboard-Palette: Akzent / Amber / Down.
function recoveryTone(score: number) {
  if (score >= 67) return 'var(--accent)'
  if (score >= 34) return 'var(--amber)'
  return 'var(--down)'
}

function Ring({
  fraction,
  value,
  label,
  color = 'var(--accent)'
}: {
  fraction: number | null
  value: string
  label: string
  color?: string
}) {
  const r = 30
  const c = 2 * Math.PI * r
  const f = fraction == null ? 0 : Math.max(0, Math.min(1, fraction))
  return (
    <div className="whoop__ring">
      <svg viewBox="0 0 72 72" aria-hidden>
        <circle cx="36" cy="36" r={r} className="whoop__track" />
        <circle
          cx="36"
          cy="36"
          r={r}
          className="whoop__arc"
          style={{ stroke: color, strokeDasharray: `${f * c} ${c}` }}
        />
      </svg>
      <span className="whoop__value">{value}</span>
      <span className="whoop__label">{label}</span>
    </div>
  )
}

function hours(ms: number) {
  const min = Math.round(ms / 60000)
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}`
}

// Kopplung direkt im Dashboard: Link zu WHOOP, danach landet der Browser
// absichtlich auf einer Fehlerseite unter https://localhost – deren Adresse
// hier einfügen. Der Link wird vorab geladen und als echter <a> gerendert,
// weil iOS per Skript geöffnete Fenster blockiert.
export function WhoopConnect({ onDone }: { onDone: () => void }) {
  const [link, setLink] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/whoop/link')
      .then((r) => r.json())
      .then((d) => (d.url ? setLink(d.url) : setMsg(d.error ?? 'Link nicht verfügbar.')))
      .catch(() => setMsg('Link nicht verfügbar.'))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/whoop/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pasted })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Kopplung fehlgeschlagen.')
      onDone()
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="whoop__connect" onSubmit={submit}>
      <p className="whoop__step">
        <b>1.</b> Bei WHOOP anmelden und zustimmen.
      </p>
      <a
        className={`whoop__btn ${link ? '' : 'is-disabled'}`}
        href={link ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        Mit WHOOP verbinden
      </a>
      <p className="whoop__step">
        <b>2.</b> Du landest auf einer Fehlerseite – das ist gewollt. Deren komplette Adresse
        kopieren und hier einfügen:
      </p>
      <input
        className="whoop__input"
        type="url"
        inputMode="url"
        placeholder="https://localhost/whoop-callback?code=…"
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <button className="whoop__btn" type="submit" disabled={busy || !pasted.trim()}>
        {busy ? 'Koppelt …' : 'Koppeln'}
      </button>
      {msg && <p className="whoop__msg">{msg}</p>}
    </form>
  )
}

export default function WhoopCard() {
  const { data, loading, error, reload } = useApi<WhoopData>('/api/whoop', 10 * 60 * 1000)

  let body
  if (loading) body = <div className="state">Lädt …</div>
  else if (error) body = <div className="state">{error}</div>
  else if (!data?.configured)
    body = (
      <div className="state">
        WHOOP ist noch nicht eingerichtet – Anleitung in <code>CONNECT.md</code>.
      </div>
    )
  else if (!data.connected) body = <WhoopConnect onDone={reload} />
  else {
    const { recovery, strain, sleep } = data
    body = (
      <>
        <div className="whoop__rings">
          <Ring
            fraction={recovery ? recovery.score / 100 : null}
            value={recovery ? `${Math.round(recovery.score)}%` : '–'}
            label="Recovery"
            color={recovery ? recoveryTone(recovery.score) : undefined}
          />
          {/* Strain läuft bei WHOOP von 0 bis 21. */}
          <Ring
            fraction={strain != null ? strain / 21 : null}
            value={strain != null ? strain.toFixed(1) : '–'}
            label="Strain"
          />
          <Ring
            fraction={sleep ? sleep.performance / 100 : null}
            value={sleep ? `${Math.round(sleep.performance)}%` : '–'}
            label="Schlaf"
          />
        </div>
        <dl className="whoop__facts">
          <div>
            <dt>HRV</dt>
            <dd>{recovery ? `${Math.round(recovery.hrv)} ms` : '–'}</dd>
          </div>
          <div>
            <dt>Ruhepuls</dt>
            <dd>{recovery ? Math.round(recovery.restingHr) : '–'}</dd>
          </div>
          <div>
            <dt>Schlafdauer</dt>
            <dd>{sleep?.durationMs ? hours(sleep.durationMs) : '–'}</dd>
          </div>
        </dl>
      </>
    )
  }

  return (
    <article className="card">
      <div className="card__head">
        <h3 className="card__title">WHOOP</h3>
      </div>
      {body}
    </article>
  )
}
