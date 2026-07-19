// ===========================================================================
// REGISTRY der Briefing-Karten (unterhalb der Märkte-Sektion).
// Neues Modul: Komponente bauen -> Icon ergänzen -> hier eintragen.
// Die Märkte-Sektion (Kurse + Chart) ist eigenständig, siehe MarketsSection.
// ===========================================================================
import type { ModuleDef } from '../types.ts'
import { WeatherIcon, CalendarIcon, ExamIcon, SwapIcon, MailIcon, TrendingIcon, GlobeIcon, WalletIcon } from '../components/icons.tsx'

import WeatherModule from './WeatherModule.tsx'
import CalendarModule from './CalendarModule.tsx'
import ExamsModule from './ExamsModule.tsx'
import SubstitutionModule from './SubstitutionModule.tsx'
import MailModule from './MailModule.tsx'
import FinanceNewsModule from './FinanceNewsModule.tsx'
import WorldNewsModule from './WorldNewsModule.tsx'
import BudgetModule from './BudgetModule.tsx'

export const MODULES: ModuleDef[] = [
  { id: 'weather', title: 'Wetter', icon: WeatherIcon, Component: WeatherModule },
  { id: 'exams', title: 'Klausuren', icon: ExamIcon, Component: ExamsModule },
  { id: 'calendar', title: 'Kalender', icon: CalendarIcon, Component: CalendarModule },
  { id: 'substitution', title: 'Vertretungsplan', icon: SwapIcon, Component: SubstitutionModule },
  { id: 'finance-news', title: 'Finanznews', icon: TrendingIcon, Component: FinanceNewsModule },
  { id: 'world-news', title: 'Welt-News', icon: GlobeIcon, Component: WorldNewsModule },
  { id: 'mails', title: 'Wichtige Mails', icon: MailIcon, Component: MailModule },
  { id: 'budget', title: 'Einnahmen & Ausgaben', icon: WalletIcon, Component: BudgetModule, experimental: true }
]
