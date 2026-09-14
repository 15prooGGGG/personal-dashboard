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

// Watchlist / Finnhub (vom Backend /api/watchlist, /api/finnhub/search) ------
export interface SymbolHit {
  symbol: string
  display: string
  name: string
  type: string
  source: 'finnhub' | 'coingecko'
}

export interface WatchlistEntry {
  symbol: string
  display: string
  name: string
  type: string
  source: 'finnhub' | 'coingecko'
  addedAt: string
  price?: number | null
  change?: number | null
  changePercent?: number | null
  currency?: string
  high?: number | null
  low?: number | null
  open?: number | null
  previousClose?: number | null
  marketTime?: number | null
  spark?: number[] | null
  sparkRange?: string | null
  error?: string
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
export interface Todo {
  id: string
  text: string
  done: boolean
  createdDate: string
  completedDate: string | null
}
export interface MailItem {
  id: string
  sender: string
  subject: string
  receivedAt: string
  topic?: string
}
// Vertretungsplan (vom Backend /api/substitutions, Quelle: Schulportal Hessen).
// Die Felder kommen aus den data-field-Attributen des Portals; welche davon
// gefüllt sind, entscheidet die Schule – deshalb ist alles optional. Unbekannte
// Spalten reicht der Server unter ihrem Originalnamen durch (Index-Signatur).
export interface SubstitutionEntry {
  lesson?: string
  subject?: string
  subjectOld?: string
  className?: string
  substitute?: string
  teacher?: string
  teacherOld?: string
  room?: string
  roomOld?: string
  kind?: string
  note?: string
  [field: string]: string | undefined
}

// Tagesinfos stehen im Portal in einer eigenen Tabelle neben den Vertretungen:
// Unterrichtsfrei, Klausuren, Aushänge. Oft die wichtigere Meldung – sie
// verschiebt den ganzen Tag, taucht aber in keiner Vertretungszeile auf.
export interface SubstitutionInfo {
  title: string | null
  lines: string[]
}

export interface SubstitutionDay {
  label: string
  date: string | null
  week?: string | null
  updatedAt?: string | null
  infos: SubstitutionInfo[]
  entries: SubstitutionEntry[]
}

export interface SubstitutionPlan {
  configured: boolean
  fetchedAt?: string
  who?: string | null
  // ok = es gibt etwas zu zeigen, empty = Portal meldet nichts,
  // unknown = Markup unklar
  state?: 'ok' | 'empty' | 'unknown'
  days: SubstitutionDay[]
  // Zählt nur Vertretungen. Ein Tag kann total 0 haben und trotzdem
  // "Unterrichtsfrei, 6 Std." melden – deshalb zusätzlich infoTotal.
  total: number
  infoTotal?: number
  note?: string | null
  error?: string
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
