import { watchlist } from '../data/mock.ts'

const fmtPrice = (v: number, currency: string) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: v >= 1000 ? 0 : 2
  }).format(v)

export default function StocksModule() {
  return (
    <table className="stocks">
      <thead>
        <tr>
          <th scope="col">Symbol</th>
          <th scope="col">Kurs</th>
          <th scope="col" className="stocks__delta-col">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {watchlist.map((s) => {
          const up = s.changePercent >= 0
          return (
            <tr key={s.symbol}>
              <th scope="row" className="stocks__sym">
                <span className="stocks__ticker data">{s.symbol}</span>
                <span className="muted stocks__name">{s.name}</span>
              </th>
              <td className="data stocks__price">{fmtPrice(s.price, s.currency)}</td>
              <td className={`data stocks__delta ${up ? 'is-up' : 'is-down'}`}>
                {up ? '+' : '−'}
                {Math.abs(s.changePercent).toFixed(2)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
