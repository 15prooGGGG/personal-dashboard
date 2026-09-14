import { useState } from 'react'
import PageSection from '../components/PageSection.tsx'
import PdfPageViewer, { type Half } from '../components/PdfPageViewer.tsx'
import { BookIcon } from '../components/icons.tsx'
import { useApi } from '../lib/useApi.ts'
import { useMediaQuery } from '../lib/useMediaQuery.ts'

interface StatusResponse {
  configured: boolean
}
interface SearchResponse {
  configured: boolean
  found?: boolean
  pdfPage?: number
  exact?: boolean
  half?: 'left' | 'right'
  error?: string
}

export default function LoesungsbuchSection() {
  const { data: status, loading } = useApi<StatusResponse>('/api/loesungsbuch')
  const isNarrow = useMediaQuery('(max-width: 720px)')
  const [seite, setSeite] = useState('')
  const [nr, setNr] = useState('')
  const [pdfPage, setPdfPage] = useState(1)
  // null = folgt automatisch der Bildschirmbreite (Doppelseite auf Desktop,
  // eine Hälfte auf dem Handy); true/false überschreibt das manuell.
  const [croppedOverride, setCroppedOverride] = useState<boolean | null>(null)
  const [half, setHalf] = useState<Half>('left')
  const [hint, setHint] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  const cropped = croppedOverride ?? isNarrow
  const activeHalf: Half = cropped ? half : null

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const seiteNum = parseInt(seite, 10)
    const nrNum = parseInt(nr, 10)
    if (!Number.isInteger(seiteNum) || !Number.isInteger(nrNum)) {
      setHint('Bitte Seite und Nr. angeben.')
      return
    }
    setSearching(true)
    setHint(null)
    try {
      const res = await fetch(`/api/loesungsbuch/search?seite=${seiteNum}&nr=${nrNum}`)
      const data = (await res.json()) as SearchResponse
      if (!data.found) {
        setHint(`Seite ${seiteNum} nicht im Buch gefunden.`)
      } else {
        setPdfPage(data.pdfPage!)
        setHalf(data.half === 'right' ? 'right' : 'left')
        setHint(
          data.exact
            ? null
            : `Aufgabe ${nrNum} nicht exakt erkannt – zeige Seite ${seiteNum} ab hier.`
        )
      }
    } catch {
      setHint('Suche gerade nicht möglich.')
    } finally {
      setSearching(false)
    }
  }

  function handleNavigate(page: number, nextHalf: Half) {
    setPdfPage(page)
    if (cropped) setHalf(nextHalf === 'right' ? 'right' : 'left')
  }

  if (loading) {
    return (
      <PageSection title="Lösungsbuch" icon={BookIcon}>
        <div className="state">Lädt …</div>
      </PageSection>
    )
  }

  if (!status?.configured) {
    return (
      <PageSection title="Lösungsbuch" icon={BookIcon}>
        <div className="setup">
          <p className="setup__lead">Das Lösungsbuch ist auf dem Server noch nicht hinterlegt.</p>
          <p className="muted">
            PDF als <code>loesungsbuch.pdf</code> nach <code>data/</code> legen und den Index dazu bauen.
          </p>
        </div>
      </PageSection>
    )
  }

  return (
    <PageSection title="Lösungsbuch" icon={BookIcon} note="Fundamente der Mathematik · Q1/Q2">
      <div className="card">
        <form className="loesungsbuch__form" onSubmit={search}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={seite}
            onChange={(e) => setSeite(e.target.value)}
            placeholder="Seite"
            aria-label="Buchseite"
          />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={nr}
            onChange={(e) => setNr(e.target.value)}
            placeholder="Nr."
            aria-label="Aufgaben-Nummer"
          />
          <button className="btn" type="submit" disabled={searching}>
            {searching ? 'Suche …' : 'Springen'}
          </button>
          <button
            type="button"
            className="btn btn--ghost loesungsbuch__modebtn"
            onClick={() => setCroppedOverride(!cropped)}
          >
            {cropped ? 'Doppelseite' : 'Einzelseite'}
          </button>
        </form>
        {hint && <p className="search__hint">{hint}</p>}

        <div className="loesungsbuch__frame">
          <PdfPageViewer
            url="/api/loesungsbuch/pdf"
            page={pdfPage}
            half={activeHalf}
            onNavigate={handleNavigate}
          />
        </div>
      </div>
    </PageSection>
  )
}
