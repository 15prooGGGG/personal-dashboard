import type { ComponentType, SVGProps } from 'react'

// Modul-Registry (für die Briefing-Karten unterhalb der Märkte-Sektion) -------
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

export interface ModuleDef {
  id: string
  title: string
  icon: IconComponent
  Component: ComponentType
  experimental?: boolean
}

// Live-Kurse (vom Backend /api/stocks) ---------------------------------------
export interface Quote {
  symbol: string
  name: string
  short: string
  price: number | null
  currency: string
  changePercent: number | null
  previousClose: number | null
  marketTime: number | null
  delayed: boolean
}

export interface HistoryPoint {
  t: number // ms
  close: number
}

export interface History {
  symbol: string
  range: string
  interval: string
  currency: string
  points: HistoryPoint[]
}

// Mock-Datenmodelle (übrige Module) ------------------------------------------
export interface WeatherForecastHour {
  time: string
  tempC: number
}
export interface Weather {
  location: string
  tempC: number
  feelsLikeC: number
  condition: string
  highC: number
  lowC: number
  precipitationProbability: number
  forecast: WeatherForecastHour[]
}
export interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string | null
  location?: string
  allDay?: boolean
  recurring?: boolean
  school?: boolean
  priority?: number
  priorityLabel?: string
}
export interface MailItem {
  id: string
  sender: string
  subject: string
  receivedAt: string
  topic?: string
}
export type SubstitutionKind = 'cancelled' | 'room-change' | 'substitution'
export interface SubstitutionEntry {
  id: string
  lesson: string
  subject: string
  kind: SubstitutionKind
  note: string
}
export interface NewsItem {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string
}
export interface BudgetSummary {
  currency: string
  income: number
  expenses: number
  recentTransactions: { id: string; label: string; amount: number }[]
}
export interface Exam {
  id: string
  subject: string
  date: string
  topic?: string
}
