import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { ChevronRightIcon } from './icons.tsx'

GlobalWorkerOptions.workerSrc = workerSrc

export type Half = 'left' | 'right' | null

interface Props {
  url: string
  page: number
  half: Half
  onNavigate: (page: number, half: Half) => void
}

// Rendert eine einzelne PDF-Seite auf ein <canvas>. Anders als ein
// <iframe src="...pdf#page=N"> ignorieren mobile Browser (Android Chrome,
// teils iOS Safari) den #page-Anker beim eingebetteten nativen PDF-Viewer
// und zeigen immer Seite 1 – pdf.js rendert selbst und ist plattformunabhängig.
//
// Jede PDF-Seite ist im Original eine gedruckte Doppelseite (zwei Buchseiten
// nebeneinander). Auf schmalen Bildschirmen wird deshalb bei Bedarf nur eine
// Hälfte gerendert (siehe `half`) – dafür rendert pdf.js die Doppelseite
// zunächst in doppelter Auflösung in ein Offscreen-Canvas und nur die
// gewünschte Hälfte wird auf das sichtbare Canvas kopiert. So bleibt der
// Text auf dem Handy lesbar groß, statt auf ein Viertel der Breite gequetscht
// zu werden.
export default function PdfPageViewer({ url, page, half, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [resizeTick, setResizeTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const loadingTask = getDocument({ url })
    loadingTask.promise.then(
      (doc) => {
        if (cancelled) return
        docRef.current = doc
        setNumPages(doc.numPages)
        setStatus('ready')
      },
      () => {
        if (!cancelled) setStatus('error')
      }
    )
    return () => {
      cancelled = true
      loadingTask.destroy()
      docRef.current = null
    }
  }, [url])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (status !== 'ready' || !docRef.current || !container || !canvas) return

    const pageNum = Math.min(Math.max(page, 1), numPages)
    let cancelled = false

    async function render() {
      const pdfPage = await docRef.current!.getPage(pageNum)
      if (cancelled) return
      const baseViewport = pdfPage.getViewport({ scale: 1 })
      const dpr = window.devicePixelRatio || 1
      const cropping = half === 'left' || half === 'right'
      // Zugeschnitten: Skalierung verdoppeln, damit eine Buchseiten-Hälfte
      // die volle Containerbreite füllt statt nur ein Viertel.
      const widthFactor = cropping ? baseViewport.width / 2 : baseViewport.width
      const scale = (container!.clientWidth * dpr) / widthFactor
      const viewport = pdfPage.getViewport({ scale })

      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      renderTaskRef.current?.cancel()

      if (cropping) {
        const off = document.createElement('canvas')
        off.width = viewport.width
        off.height = viewport.height
        const offCtx = off.getContext('2d')
        if (!offCtx) return
        const task = pdfPage.render({ canvas: off, canvasContext: offCtx, viewport })
        renderTaskRef.current = task
        try {
          await task.promise
        } catch (err) {
          if (err instanceof Error && err.name !== 'RenderingCancelledException') throw err
          return
        }
        if (cancelled) return
        const halfW = viewport.width / 2
        canvas!.width = halfW
        canvas!.height = viewport.height
        canvas!.style.width = `${container!.clientWidth}px`
        canvas!.style.height = `${viewport.height / dpr}px`
        ctx.clearRect(0, 0, canvas!.width, canvas!.height)
        ctx.drawImage(
          off,
          half === 'left' ? 0 : halfW,
          0,
          halfW,
          viewport.height,
          0,
          0,
          halfW,
          viewport.height
        )
      } else {
        canvas!.width = viewport.width
        canvas!.height = viewport.height
        canvas!.style.width = `${container!.clientWidth}px`
        canvas!.style.height = `${viewport.height / dpr}px`
        const task = pdfPage.render({ canvas: canvas!, canvasContext: ctx, viewport })
        renderTaskRef.current = task
        try {
          await task.promise
        } catch (err) {
          if (err instanceof Error && err.name !== 'RenderingCancelledException') throw err
        }
      }
    }

    render()
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [status, page, half, numPages, resizeTick])

  // Bei Größenänderung des Containers (Rotation, Sidebar auf/zu) neu rendern.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setResizeTick((t) => t + 1))
    })
    observer.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  const pageNum = Math.min(Math.max(page, 1), numPages || page)

  function goPrev() {
    if (half === 'right') onNavigate(pageNum, 'left')
    else if (half === 'left') onNavigate(pageNum - 1, 'right')
    else onNavigate(pageNum - 1, null)
  }
  function goNext() {
    if (half === 'left') onNavigate(pageNum, 'right')
    else if (half === 'right') onNavigate(pageNum + 1, 'left')
    else onNavigate(pageNum + 1, null)
  }

  const atStart = pageNum <= 1 && half !== 'right'
  const atEnd = pageNum >= numPages && half !== 'left'
  const halfLabel = half === 'left' ? ' · linke Seite' : half === 'right' ? ' · rechte Seite' : ''

  return (
    <div className="pdfviewer">
      <div className="pdfviewer__canvas" ref={containerRef}>
        {status === 'error' && <div className="state">PDF konnte nicht geladen werden.</div>}
        {status === 'loading' && <div className="state">Lädt …</div>}
        <canvas ref={canvasRef} style={{ display: status === 'ready' ? 'block' : 'none' }} />
      </div>
      <div className="pdfviewer__nav">
        <button
          type="button"
          className="pdfviewer__navbtn"
          disabled={atStart}
          onClick={goPrev}
          aria-label="Vorherige Seite"
        >
          <ChevronRightIcon style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span className="pdfviewer__pagenum">
          {status === 'ready' ? `Blatt ${pageNum} / ${numPages}${halfLabel}` : ' '}
        </span>
        <button
          type="button"
          className="pdfviewer__navbtn"
          disabled={atEnd}
          onClick={goNext}
          aria-label="Nächste Seite"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  )
}
