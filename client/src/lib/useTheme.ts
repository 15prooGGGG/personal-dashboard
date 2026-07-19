import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

// Hell-/Dunkel-Umschalter. Startwert = Systemeinstellung; danach manuell
// umschaltbar. Zustand im Speicher (kein localStorage – bewusst schlank).
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }
}
