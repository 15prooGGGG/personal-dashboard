import type { ComponentType, SVGProps } from 'react'

// ---------------------------------------------------------------------------
// Modul-Registry-Typen
// Jedes Briefing-Modul beschreibt sich selbst über ModuleDef. Neue Module
// werden ausschließlich in src/modules/registry.tsx registriert.
// ---------------------------------------------------------------------------
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

export type CardSpan = 'sm' | 'md' | 'lg'

export interface ModuleDef {
  /** Stabile ID, dient auch als Anker (#module-<id>) für die Navigation. */
  id: string
  /** Kurzlabel für Sidebar und Kartentitel. */
  title: string
  /** SVG-Icon-Komponente (kein Emoji – siehe UI/UX-Checkliste). */
  icon: IconComponent
  /** Karteninhalt. */
  Component: ComponentType
  /** Breite im Bento-Grid. Default: 'sm'. */
  span?: CardSpan
  /** Experimentell -> wird sichtbar markiert und kann ausgeblendet werden. */
  experimental?: boolean
}

// ---------------------------------------------------------------------------
// Datenmodelle je Modul (Grundlage für spätere echte APIs)
// ---------------------------------------------------------------------------
export interface WeatherForecastHour {
  time: string // "08:00"
  tempC: number
  condition: string
}

export interface Weather {
  location: string
  tempC: number
  feelsLikeC: number
  condition: string
  highC: number
  lowC: number
  precipitationProbability: number // 0..100
  forecast: WeatherForecastHour[]
}

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO
  end?: string // ISO
  location?: string
  allDay?: boolean
}

export interface MailItem {
  id: string
  sender: string
  subject: string
  preview: string
  receivedAt: string // ISO
}

export type SubstitutionKind = 'cancelled' | 'room-change' | 'substitution' | 'info'

export interface SubstitutionEntry {
  id: string
  lesson: string // "3.-4. Stunde"
  subject: string
  kind: SubstitutionKind
  note: string
}

export interface NewsItem {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string // ISO
}

export interface Stock {
  symbol: string
  name: string
  price: number
  changePercent: number // negativ = Minus
  currency: string
}

export interface BudgetSummary {
  currency: string
  income: number
  expenses: number
  recentTransactions: { id: string; label: string; amount: number; date: string }[]
}

export interface Exam {
  id: string
  subject: string
  date: string // ISO (Tag der Klausur)
  topic?: string
}
