// Einheitliche Outline-Icons als Inline-SVG (kein Emoji). currentColor.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = (props: P) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props
})

export const WeatherIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M17 18a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.5 3.5 0 0 0 7 18Z" />
    <path d="M12 3v1M4.9 6l.7.7M19.1 6l-.7.7" />
  </svg>
)
export const CalendarIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v3M16 3v3" />
  </svg>
)
export const MailIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
)
export const SwapIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h13a4 4 0 0 1 0 8h-1" />
    <path d="m17 20 4-4-4-4" />
  </svg>
)
export const TrendingIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </svg>
)
export const GlobeIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
)
export const WalletIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h12v4" />
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <circle cx="16.5" cy="13" r="1.25" />
  </svg>
)
export const ExamIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4 2 9l10 5 10-5-10-5Z" />
    <path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
  </svg>
)
export const ChevronRightIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)
export const SunIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const MoonIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
)
export const HomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
)
export const TodoIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="m8 12 3 3 5-6" />
  </svg>
)
// Wortmarke: aufgehende Linie über dem Horizont – Morgen + Märkte.
export const LogoMark = (p: P) => (
  <svg {...base(p)} strokeWidth={2}>
    <path d="M4 17h16" />
    <path d="m5 13 4-4 3 3 6-6" />
    <path d="M15 6h4v4" />
  </svg>
)
// Stundenplan: Raster aus Zeitblöcken.
export const TimetableIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M9 9.5v11M15 9.5v11" />
  </svg>
)

// Second Brain: aufgeschlagenes Notizbuch.
export const VaultIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 7.5C10.5 6 8.5 5.5 4 5.5v12c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-12c-4.5 0-6.5.5-8 2Z" />
    <path d="M12 7.5v12" />
  </svg>
)
export const CollapseIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="M9.5 4.5v15" />
  </svg>
)
// Vertretungsplan: Schulgebäude mit Fahne.
export const SchoolIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V10l8-5 8 5v10" />
    <path d="M2 20h20" />
    <path d="M9.5 20v-5h5v5" />
  </svg>
)
export const StarIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3.5 2.6 5.4 5.9.85-4.25 4.15 1 5.9L12 17.05 6.75 19.8l1-5.9L3.5 9.75l5.9-.85Z" />
  </svg>
)
// Lösungsbuch: aufgeschlagenes Buch mit Lesezeichen.
export const BookIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5.5a2 2 0 0 1 2-2h5v15H6a2 2 0 0 0-2 2Z" />
    <path d="M20 5.5a2 2 0 0 0-2-2h-5v15h5a2 2 0 0 1 2 2Z" />
    <path d="M9.5 7h2v6l-1-.75L9.5 13Z" />
  </svg>
)
export const ChartIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4v16h16" />
    <path d="m7 14 3-3 3 3 4-5" />
  </svg>
)
