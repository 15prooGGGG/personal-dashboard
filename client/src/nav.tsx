// ===========================================================================
// NAVIGATIONS-REGISTRY der linken Leiste.
// Neuen Bereich hinzufügen: hier einen Eintrag ergänzen. 'home' zeigt die
// Märkte-Übersicht; alle anderen zeigen vorerst eine Platzhalter-Seite, bis
// echter Inhalt gebaut wird (siehe App.tsx / PlaceholderSection).
// ===========================================================================
import type { IconComponent } from './types.ts'
import { HomeIcon, ChartIcon, StarIcon, CalendarIcon, MailIcon, GlobeIcon, TrendingIcon, TodoIcon } from './components/icons.tsx'

export interface NavItem {
  id: string
  label: string
  icon: IconComponent
}

export const NAV: NavItem[] = [
  { id: 'home', label: 'Übersicht', icon: HomeIcon },
  { id: 'stocks', label: 'Aktien', icon: ChartIcon },
  { id: 'watchlist', label: 'Watchlist', icon: StarIcon },
  { id: 'calendar', label: 'Kalender', icon: CalendarIcon },
  { id: 'mail', label: 'E-Mail', icon: MailIcon },
  { id: 'news', label: 'News', icon: GlobeIcon },
  { id: 'finance', label: 'Finanznews', icon: TrendingIcon },
  { id: 'todo', label: 'To-Do', icon: TodoIcon }
]
