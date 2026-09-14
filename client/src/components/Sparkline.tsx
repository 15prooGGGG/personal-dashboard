import { useId } from 'react'

// ===========================================================================
// Sparkline – kleiner Kursverlauf für die Watchlist.
// ---------------------------------------------------------------------------
// Bewusst handgezeichnetes SVG statt Recharts (wie in PriceChart): In der Liste
// stehen bis zu 25 davon, und ein ResponsiveContainer je Zeile würde bei jedem
// Poll neu messen. Hier reicht ein viewBox-Pfad – ohne Achsen, ohne State.
//
// Design: dieselbe 45°-Schraffur wie die große Chart (Signature des Systems),
// die Linie in Auf/Ab-Farbe. Die gestrichelte Grundlinie markiert den ersten
// Kurs des Zeitraums – ohne sie sagt eine Sparkline nicht, ob die Kurve über
// oder unter ihrem Startwert endet.
//
// Zum viewBox: Die SVGs werden per CSS gedehnt (preserveAspectRatio="none"),
// damit sie sich der Zeilen- bzw. Kartenbreite anpassen. Die viewBox-Maße sind
// deshalb nah an den tatsächlichen Pixelmaßen gewählt – sonst kippt die
// Schraffur aus den 45° und der Punkt am Ende wird zur Ellipse.
// ===========================================================================

const ROW = { w: 100, h: 32, pad: 3, stroke: 1.6, dot: 2.6 }
const WIDE = { w: 500, h: 110, pad: 10, stroke: 2, dot: 4 }

interface SparklineProps {
  points: number[] | null | undefined
  wide?: boolean
  range?: string | null
}

export default function Sparkline({ points, wide, range }: SparklineProps) {
  // useId liefert in React 19 Zeichen wie «r0» – für eine SVG-ID (url(#…))
  // auf Alphanumerisches reduzieren.
  const hatchId = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const { w, h, pad, stroke, dot } = wide ? WIDE : ROW
  const cls = `spark ${wide ? 'spark--wide' : ''}`

  // Ohne Verlauf trotzdem etwas zeichnen: Sonst springt die Zeilenbreite,
  // sobald die Daten nachkommen.
  if (!points || points.length < 2) {
    return (
      <svg
        className={`${cls} spark--empty`}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1={h / 2}
          x2={w}
          y2={h / 2}
          stroke="currentColor"
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min

  const round = (n: number) => Math.round(n * 100) / 100
  // Rechts um den Punktradius einrücken, sonst schneidet der SVG-Rand den
  // Endpunkt zur Hälfte ab.
  const x = (i: number) => (i / (points.length - 1)) * (w - dot)
  // Ein völlig flacher Verlauf hat keine Spanne – dann mittig zeichnen, statt
  // durch 0 zu teilen.
  const y = (v: number) => (span === 0 ? h / 2 : h - pad - ((v - min) / span) * (h - pad * 2))

  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${round(x(i))} ${round(y(v))}`).join(' ')
  const area = `${line} L${w - dot} ${h} L0 ${h} Z`

  // Die Farbe richtet sich nach dem Zeitraum der Linie, nicht nach der
  // Tagesveränderung daneben: Ein Wert kann heute im Plus und über den Monat im
  // Minus stehen – eine grün gefärbte Abwärtskurve wäre schlicht falsch.
  const rising = points[points.length - 1] >= points[0]
  const last = points.length - 1

  return (
    <svg
      className={`${cls} ${rising ? 'up' : 'down'}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Kursverlauf${range ? ` über ${range}` : ''}: ${rising ? 'steigend' : 'fallend'}`}
    >
      <defs>
        <pattern
          id={hatchId}
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2.5" opacity="0.16" />
        </pattern>
      </defs>

      <path d={area} fill={`url(#${hatchId})`} stroke="none" />
      <line
        x1="0"
        y1={round(y(points[0]))}
        x2={w}
        y2={round(y(points[0]))}
        stroke="currentColor"
        strokeDasharray="2 3"
        opacity="0.35"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Letzter Kurs als Punkt – markiert das „jetzt“ am rechten Rand. */}
      <circle
        cx={round(x(last))}
        cy={round(y(points[last]))}
        r={dot}
        fill="currentColor"
        stroke="var(--surface)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
