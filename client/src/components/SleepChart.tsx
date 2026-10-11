import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipProps } from 'recharts'
import { formatDateShort } from '../lib/format.ts'

export interface SleepPoint {
  t: number
  v: number
}

// Gleiche Optik wie PriceChart (Schraffur, Achsen), nur mit eigenem Werte-Format.
export default function SleepChart({
  data,
  format,
  axis = format,
  domain
}: {
  data: SleepPoint[]
  format: (v: number) => string
  axis?: (v: number) => string
  domain?: [number | 'auto', number | 'auto']
}) {
  if (data.length < 2) return <div className="chart-empty">Noch zu wenige Nächte für einen Verlauf.</div>

  function Tip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null
    const p = payload[0]
    return (
      <div className="tip">
        <div className="tip__d">
          {new Date(p.payload.t as number).toLocaleDateString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: 'long'
          })}
        </div>
        <div className="tip__v">{format(p.value as number)}</div>
      </div>
    )
  }

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          {/* Muss direktes Kind der Chart sein – siehe PriceChart. */}
          <defs>
            <pattern id="hatch-sleep" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
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
            domain={domain ?? ['auto', 'auto']}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) => axis(v as number)}
          />
          <Tooltip content={<Tip />} cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--accent-deep)"
            strokeWidth={2}
            fill="url(#hatch-sleep)"
            dot={data.length <= 14 ? { r: 2.5, fill: 'var(--accent-deep)', strokeWidth: 0 } : false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--accent-deep)' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
