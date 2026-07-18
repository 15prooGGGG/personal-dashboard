// ===========================================================================
// MOCK-DATEN – zentrale, austauschbare Datenquelle
// ---------------------------------------------------------------------------
// Alle Module lesen ausschließlich aus dieser Datei. Zum Anbinden echter
// APIs jeweils den markierten INTEGRATION-Block ersetzen (z. B. durch einen
// fetch-Hook), ohne die Modul-Komponenten anzufassen. Die Datumsangaben sind
// relativ zu "heute" erzeugt, damit Countdowns/Termine immer plausibel sind.
// ===========================================================================
import type {
  Weather,
  CalendarEvent,
  MailItem,
  SubstitutionEntry,
  NewsItem,
  Stock,
  BudgetSummary,
  Exam
} from '../types.ts'

// Hilfen für relative Zeitpunkte -------------------------------------------------
const now = new Date()
const atToday = (h: number, m = 0) => {
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const inDays = (days: number, h = 8, m = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// --- WETTER -----------------------------------------------------------------
// INTEGRATION: z. B. Open-Meteo (kostenlos, kein Key) für Seligenstadt/Gelnhausen.
// https://api.open-meteo.com/v1/forecast?latitude=50.04&longitude=8.97&current=...&hourly=...
export const weather: Weather = {
  location: 'Seligenstadt',
  tempC: 12,
  feelsLikeC: 10,
  condition: 'Wechselnd bewölkt',
  highC: 18,
  lowC: 9,
  precipitationProbability: 30,
  forecast: [
    { time: '08:00', tempC: 12, condition: 'Bewölkt' },
    { time: '11:00', tempC: 15, condition: 'Wolkig' },
    { time: '14:00', tempC: 18, condition: 'Heiter' },
    { time: '17:00', tempC: 16, condition: 'Wolkig' },
    { time: '20:00', tempC: 12, condition: 'Klar' }
  ]
}

// --- KALENDER ---------------------------------------------------------------
// INTEGRATION: CalDAV / Google Calendar API / ICS-Feed -> nach CalendarEvent mappen.
export const calendar: CalendarEvent[] = [
  { id: 'c1', title: 'LK Mathe – Analysis', start: atToday(8, 0), end: atToday(9, 30), location: 'Raum A204' },
  { id: 'c2', title: 'Bio – Genetik Referat', start: atToday(11, 45), end: atToday(13, 15), location: 'Raum B112' },
  { id: 'c3', title: 'Training (Verein)', start: atToday(18, 0), end: atToday(19, 30), location: 'Sporthalle' },
  { id: 'c4', title: 'Zahnarzt', start: inDays(1, 15, 30), location: 'Praxis Dr. Berg' }
]

// --- WICHTIGE MAILS ---------------------------------------------------------
// INTEGRATION: Gmail/IMAP – nur als "wichtig" eingestufte Mails (Label/Flag),
// KEIN voller Posteingang.
export const importantMails: MailItem[] = [
  {
    id: 'm1',
    sender: 'Sekretariat Gymnasium',
    subject: 'Anmeldung Studienfahrt Q1',
    preview: 'Bitte die Einverständniserklärung bis Freitag zurückgeben …',
    receivedAt: atToday(7, 12)
  },
  {
    id: 'm2',
    sender: 'Trainer Markus',
    subject: 'Spielverlegung Sonntag',
    preview: 'Das Auswärtsspiel beginnt eine Stunde früher, Treffpunkt 9:00 …',
    receivedAt: atToday(6, 48)
  },
  {
    id: 'm3',
    sender: 'Deutsche Bank Depot',
    subject: 'Order ausgeführt',
    preview: 'Ihre Kauforder über 3 Anteile wurde zum Kurs von … ausgeführt.',
    receivedAt: inDays(-1, 20, 5)
  }
]

// --- VERTRETUNGSPLAN --------------------------------------------------------
// INTEGRATION: DSBmobile / WebUntis / schuleigener Feed – nur Änderungen filtern.
export const substitutions: SubstitutionEntry[] = [
  { id: 's1', lesson: '1. Stunde', subject: 'Englisch', kind: 'cancelled', note: 'Entfällt (Fr. Weber krank)' },
  { id: 's2', lesson: '3.–4. Stunde', subject: 'Physik', kind: 'room-change', note: 'Raum A204 → C009' },
  { id: 's3', lesson: '6. Stunde', subject: 'Geschichte', kind: 'substitution', note: 'Vertretung: Hr. Klein, Aufgaben im Buch' }
]

// --- FINANZNEWS -------------------------------------------------------------
// INTEGRATION: RSS-Feeds (Handelsblatt, Finanzen.net …) serverseitig parsen.
export const financeNews: NewsItem[] = [
  {
    id: 'f1',
    title: 'EZB deutet weitere Zinsschritte an – Märkte reagieren verhalten',
    source: 'Handelsblatt',
    url: 'https://www.handelsblatt.com/',
    publishedAt: atToday(6, 30)
  },
  {
    id: 'f2',
    title: 'Tech-Rally: Halbleiterwerte ziehen den Nasdaq nach oben',
    source: 'Finanzen.net',
    url: 'https://www.finanzen.net/',
    publishedAt: atToday(5, 55)
  },
  {
    id: 'f3',
    title: 'Bitcoin konsolidiert unter der jüngsten Höchstmarke',
    source: 'BÖRSE ONLINE',
    url: 'https://www.boerse-online.de/',
    publishedAt: inDays(-1, 22, 10)
  }
]

// --- AKTIENKURSE (Watchlist) ------------------------------------------------
// INTEGRATION: Finnhub / Twelve Data / Yahoo Finance – price + changePercent.
export const watchlist: Stock[] = [
  { symbol: 'AAPL', name: 'Apple', price: 224.31, changePercent: 1.24, currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA', price: 128.9, changePercent: 2.87, currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft', price: 441.5, changePercent: -0.42, currency: 'USD' },
  { symbol: 'SAP', name: 'SAP SE', price: 198.06, changePercent: 0.63, currency: 'EUR' },
  { symbol: 'BTC', name: 'Bitcoin', price: 61240, changePercent: -0.81, currency: 'EUR' }
]

// --- WELT-NEWS --------------------------------------------------------------
// INTEGRATION: Tagesschau/Reuters RSS – nur wichtige Schlagzeilen.
export const worldNews: NewsItem[] = [
  {
    id: 'w1',
    title: 'Klimagipfel: Staaten einigen sich auf neuen Finanzrahmen',
    source: 'Tagesschau',
    url: 'https://www.tagesschau.de/',
    publishedAt: atToday(6, 15)
  },
  {
    id: 'w2',
    title: 'Bundestag beschließt Reform des Bildungssystems',
    source: 'ZEIT ONLINE',
    url: 'https://www.zeit.de/',
    publishedAt: atToday(6, 5)
  }
]

// --- EINNAHMEN & AUSGABEN (EXPERIMENTELL) -----------------------------------
// INTEGRATION: später FinTS/Banking-API oder manuelle Eingabe.
export const budget: BudgetSummary = {
  currency: 'EUR',
  income: 120,
  expenses: 74.5,
  recentTransactions: [
    { id: 't1', label: 'Taschengeld', amount: 60, date: inDays(-2) },
    { id: 't2', label: 'Spotify', amount: -6.99, date: inDays(-3) },
    { id: 't3', label: 'Kino mit Freunden', amount: -14.5, date: inDays(-4) },
    { id: 't4', label: 'Nachhilfe gegeben', amount: 25, date: inDays(-5) }
  ]
}

// --- KLAUSURENPLANUNG -------------------------------------------------------
// INTEGRATION: manuelle Eingabe oder Schul-Terminplan.
export const exams: Exam[] = [
  { id: 'e1', subject: 'Mathe LK', date: inDays(2), topic: 'Analysis: Ableitungen & Kurvendiskussion' },
  { id: 'e2', subject: 'Englisch', date: inDays(6), topic: 'Comment & Analysis' },
  { id: 'e3', subject: 'Biologie', date: inDays(11), topic: 'Genetik' },
  { id: 'e4', subject: 'Geschichte', date: inDays(18), topic: 'Weimarer Republik' }
]
