import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipProps } from 'recharts'
import { useHistory } from '../lib/useStocks.ts'
import { formatCurrency, formatDateShort } from '../lib/format.ts'

function ChartTip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="tip">
      <div className="tip__d">
        {new Date(p.payload.t as number).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
      </div>
      <div className="tip__v">{formatCurrency(p.value as number, (p.payload.currency as string) || 'EUR')}</div>
    </div>
  )
}

interface PriceChartProps {
  symbol: string
  range: string
  interval: string
  small?: boolean
}

export default function PriceChart({ symbol, range, interval, small }: PriceChartProps) {
  const { history, loading, error } = useHistory(symbol, range, interval)

  if (error) return <div className="chart-empty">{error}</div>
  if (loading || !history?.points.length) return <div className="chart-empty">Verlauf lädt …</div>

  const data = history.points.map((p) => ({ ...p, currency: history.currency }))

  return (
    <div className={`chart ${small ? 'chart--sm' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          {/* Signature: 45°-Schraffur statt weichem Verlauf. Muss direktes
              Kind der Chart sein – Recharts filtert unbekannte Wrapper aus. */}
          <defs>
            <pattern
              id="hatch"
              width="8"
              height="8"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" style={{ fill: 'var(--hatch-bg)' }} />
              <line x1="0" y1="0" x2="0" y2="8" style={{ stroke: 'var(--hatch-line)' }} strokeWidth="3" />
            </pattern>
          </defs>
          <XAxis
            dataKey="t"
            tickFormatter={(t) => formatDateShort(t as number)}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={34}
            dy={4}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v as number)}
          />
          <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
          <Area
            type="monotone"
            dataKey="close"
            stroke="var(--accent-deep)"
            strokeWidth={2}
            fill="url(#hatch)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--accent-deep)' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
