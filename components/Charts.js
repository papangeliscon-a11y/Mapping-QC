import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const C1 = '#4f7cff'
const C2 = '#22d3a0'
const C3 = '#f43f5e'

function shortName(name) {
  return name.replace(/_(S\d+)_\d+$/, '_$1')
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString()
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(2) + '%'
}

function CustomTooltip({ active, payload, label, isPercent }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: '#111520',
      border: '1px solid rgba(100,130,255,0.2)',
      borderRadius: 6,
      padding: '10px 14px',
      fontSize: 12,
      fontFamily: 'IBM Plex Mono, monospace',
    }}>
      <div style={{ color: 'rgba(230,235,255,0.9)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.fill, marginBottom: 2 }}>
          {p.name}: {isPercent ? fmtPct(p.value) : fmtNum(p.value)}
        </div>
      ))}
    </div>
  )
}

export function AbsChart({ data, d1, d2 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 20, left: 40, bottom: 120 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,130,255,0.1)" />
        <XAxis
          dataKey="name"
          tickFormatter={(v) => shortName(v)}
          tick={{ fill: 'rgba(180,190,230,0.55)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          angle={-40}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tickFormatter={(v) => v >= 1000000 ? (v / 1000000).toFixed(0) + 'M' : v.toLocaleString()}
          tick={{ fill: 'rgba(180,190,230,0.55)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
        />
        <Tooltip content={<CustomTooltip isPercent={false} />} />
        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontFamily: 'IBM Plex Mono' }} />
        <Bar dataKey={`Mapped to ${d1}`} stackId="a" fill={C1} />
        <Bar dataKey={`Mapped to ${d2}`} stackId="a" fill={C2} />
        <Bar dataKey="Unmapped" stackId="a" fill={C3} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PctChart({ data, d1, d2 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 20, left: 40, bottom: 120 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,130,255,0.1)" />
        <XAxis
          dataKey="name"
          tickFormatter={(v) => shortName(v)}
          tick={{ fill: 'rgba(180,190,230,0.55)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          angle={-40}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tickFormatter={(v) => v + '%'}
          tick={{ fill: 'rgba(180,190,230,0.55)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
        />
        <Tooltip content={<CustomTooltip isPercent={true} />} />
        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontFamily: 'IBM Plex Mono' }} />
        <Bar dataKey={`${d1} (%)`} stackId="a" fill={C1} />
        <Bar dataKey={`${d2} (%)`} stackId="a" fill={C2} />
        <Bar dataKey="Unmapped (%)" stackId="a" fill={C3} />
      </BarChart>
    </ResponsiveContainer>
  )
}