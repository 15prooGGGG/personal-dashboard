// ===========================================================================
// MODUL-REGISTRY – die einzige Stelle, an der Module ein-/ausgehängt werden.
// ---------------------------------------------------------------------------
// Neues Modul hinzufügen:
//   1. Komponente unter src/modules/<Name>Module.tsx anlegen (liest ggf. aus
//      src/data/mock.ts).
//   2. Passendes Icon in src/components/icons.tsx ergänzen.
//   3. Hier einen Eintrag in das MODULES-Array einfügen.
// Reihenfolge im Array = Reihenfolge in Navigation und Grid.
// span: 'sm' | 'md' | 'lg' steuert die Breite im Bento-Grid.
// ===========================================================================
import type { ModuleDef } from '../types.ts'
import {
  WeatherIcon,
  CalendarIcon,
  MailIcon,
  SwapIcon,
  TrendingIcon,
  ChartIcon,
  GlobeIcon,
  WalletIcon,
  ExamIcon
} from '../components/icons.tsx'

import WeatherModule from './WeatherModule.tsx'
import StocksModule from './StocksModule.tsx'
import CalendarModule from './CalendarModule.tsx'
import ExamsModule from './ExamsModule.tsx'
import SubstitutionModule from './SubstitutionModule.tsx'
import MailModule from './MailModule.tsx'
import FinanceNewsModule from './FinanceNewsModule.tsx'
import WorldNewsModule from './WorldNewsModule.tsx'
import BudgetModule from './BudgetModule.tsx'

export const MODULES: ModuleDef[] = [
  { id: 'weather', title: 'Wetter', icon: WeatherIcon, Component: WeatherModule, span: 'sm' },
  { id: 'stocks', title: 'Aktienkurse', icon: ChartIcon, Component: StocksModule, span: 'md' },
  { id: 'calendar', title: 'Kalender', icon: CalendarIcon, Component: CalendarModule, span: 'sm' },
  { id: 'exams', title: 'Klausuren', icon: ExamIcon, Component: ExamsModule, span: 'sm' },
  { id: 'substitution', title: 'Vertretungsplan', icon: SwapIcon, Component: SubstitutionModule, span: 'md' },
  { id: 'mails', title: 'Wichtige Mails', icon: MailIcon, Component: MailModule, span: 'sm' },
  { id: 'finance-news', title: 'Finanznews', icon: TrendingIcon, Component: FinanceNewsModule, span: 'md' },
  { id: 'world-news', title: 'Welt-News', icon: GlobeIcon, Component: WorldNewsModule, span: 'sm' },
  {
    id: 'budget',
    title: 'Einnahmen & Ausgaben',
    icon: WalletIcon,
    Component: BudgetModule,
    span: 'md',
    experimental: true
  }
]
