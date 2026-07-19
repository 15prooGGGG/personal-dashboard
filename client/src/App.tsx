import TopBar from './components/TopBar.tsx'
import MarketsSection from './modules/MarketsSection.tsx'
import { useTheme } from './lib/useTheme.ts'
import { useStocks } from './lib/useStocks.ts'

export default function App() {
  const { theme, toggle } = useTheme()
  const stocks = useStocks()

  return (
    <div className="shell">
      <TopBar theme={theme} onToggleTheme={toggle} quotes={stocks.quotes} />
      <MarketsSection
        quotes={stocks.quotes}
        loading={stocks.loading}
        error={stocks.error}
        reload={stocks.reload}
      />
    </div>
  )
}
