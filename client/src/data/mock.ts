// ===========================================================================
// MOCK-DATEN der Nicht-Kurs-Module (Kurse kommen echt aus /api/stocks).
// Jeder Block ist ein Integrationspunkt für eine spätere echte Quelle.
// ===========================================================================
import type {
  Weather,
  CalendarEvent,
  MailItem,
  SubstitutionEntry,
  NewsItem,
  BudgetSummary,
  Exam
} from '../types.ts'

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

// INTEGRATION Wetter: Open-Meteo (kostenlos, kein Key) für Seligenstadt.
export const weather: Weather = {
  location: 'Seligenstadt',
  tempC: 12,
  feelsLikeC: 10,
  condition: 'Wechselnd bewölkt',
  highC: 18,
  lowC: 9,
  precipitationProbability: 30,
  forecast: [
    { time: '08:00', tempC: 12 },
    { time: '11:00', tempC: 15 },
    { time: '14:00', tempC: 18 },
    { time: '17:00', tempC: 16 },
    { time: '20:00', tempC: 12 }
  ]
}

// INTEGRATION Kalender: CalDAV / Google Calendar / ICS-Feed.
export const calendar: CalendarEvent[] = [
  { id: 'c1', title: 'LK Mathe – Analysis', start: atToday(8, 0), location: 'A204' },
  { id: 'c2', title: 'Bio – Genetik Referat', start: atToday(11, 45), location: 'B112' },
  { id: 'c3', title: 'Training (Verein)', start: atToday(18, 0), location: 'Sporthalle' },
  { id: 'c4', title: 'Zahnarzt', start: inDays(1, 15, 30), location: 'Dr. Berg' }
]

// INTEGRATION Mails: Gmail/IMAP – nur als wichtig geflaggte Mails.
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
  }
]

// INTEGRATION Vertretung: DSBmobile / WebUntis – nur Änderungen.
export const substitutions: SubstitutionEntry[] = [
  { id: 's1', lesson: '1. Std', subject: 'Englisch', kind: 'cancelled', note: 'Entfällt (Fr. Weber krank)' },
  { id: 's2', lesson: '3.–4. Std', subject: 'Physik', kind: 'room-change', note: 'A204 → C009' },
  { id: 's3', lesson: '6. Std', subject: 'Geschichte', kind: 'substitution', note: 'Vertretung Hr. Klein' }
]

// INTEGRATION Finanznews: RSS (Handelsblatt, Finanzen.net …).
export const financeNews: NewsItem[] = [
  { id: 'f1', title: 'EZB deutet weitere Zinsschritte an – Märkte reagieren verhalten', source: 'Handelsblatt', url: 'https://www.handelsblatt.com/', publishedAt: atToday(6, 30) },
  { id: 'f2', title: 'Tech-Rally: Halbleiterwerte ziehen den Nasdaq nach oben', source: 'Finanzen.net', url: 'https://www.finanzen.net/', publishedAt: atToday(5, 55) },
  { id: 'f3', title: 'Windkraft im Fokus: Analysten heben Kursziele an', source: 'BÖRSE ONLINE', url: 'https://www.boerse-online.de/', publishedAt: inDays(-1, 22, 10) }
]

// INTEGRATION Welt-News: Tagesschau / Reuters RSS – nur wichtige Schlagzeilen.
export const worldNews: NewsItem[] = [
  { id: 'w1', title: 'Klimagipfel: Staaten einigen sich auf neuen Finanzrahmen', source: 'Tagesschau', url: 'https://www.tagesschau.de/', publishedAt: atToday(6, 15) },
  { id: 'w2', title: 'Bundestag beschließt Reform des Bildungssystems', source: 'ZEIT ONLINE', url: 'https://www.zeit.de/', publishedAt: atToday(6, 5) }
]

// INTEGRATION Budget: später FinTS/Banking-API oder manuelle Eingabe.
export const budget: BudgetSummary = {
  currency: 'EUR',
  income: 120,
  expenses: 74.5,
  recentTransactions: [
    { id: 't1', label: 'Taschengeld', amount: 60 },
    { id: 't2', label: 'Spotify', amount: -6.99 },
    { id: 't3', label: 'Kino mit Freunden', amount: -14.5 },
    { id: 't4', label: 'Nachhilfe gegeben', amount: 25 }
  ]
}

// INTEGRATION Klausuren: manuelle Eingabe oder Schul-Terminplan.
export const exams: Exam[] = [
  { id: 'e1', subject: 'Mathe LK', date: inDays(2), topic: 'Analysis: Kurvendiskussion' },
  { id: 'e2', subject: 'Englisch', date: inDays(6), topic: 'Comment & Analysis' },
  { id: 'e3', subject: 'Biologie', date: inDays(11), topic: 'Genetik' },
  { id: 'e4', subject: 'Geschichte', date: inDays(18), topic: 'Weimarer Republik' }
]
