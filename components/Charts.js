import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const C1 = '#2563eb'
const C2 = '#059669'
const C3 = '#f87171'

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
      background: '#fff',
      border: '1px solid #e2e7f0',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      fontFamily: 'Inter, sans-serif',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }}>
      <div style={{ color: '#0f172a', marginBottom: 8, fontWeight: 600, fontSize: 12 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
          <span style={{ color: '#475569', flex: 1 }}>{p.name}:</span>
          <span style={{ color: '#0f172a', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
            {isPercent ? fmtPct(p.value) : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

const axisStyle = { fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' }

export function AbsChart({ data, d1, d2 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 40, bottom: 120 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e7f0" vertical={false} />
        <XAxis
          dataKey="name"
          tickFormatter={(v) => shortName(v)}
          tick={axisStyle}
          angle={-40}
          textAnchor="end"
          interval={0}
          axisLine={{ stroke: '#e2e7f0' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v}
          tick={axisStyle}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip isPercent={false} />} cursor={{ fill: 'rgba(37,99,235,0.04)' }} />
        <Legend
          verticalAlign="top"
          wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#475569' }}
        />
        <Bar dataKey={`Mapped to ${d1}`} stackId="a" fill={C1} radius={[0, 0, 0, 0]} />
        <Bar dataKey={`Mapped to ${d2}`} stackId="a" fill={C2} />
        <Bar dataKey="Unmapped" stackId="a" fill={C3} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PctChart({ data, d1, d2 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 120 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e7f0" vertical={false} />
        <XAxis
          dataKey="name"
          tickFormatter={(v) => shortName(v)}
          tick={axisStyle}
          angle={-40}
          textAnchor="end"
          interval={0}
          axisLine={{ stroke: '#e2e7f0' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => v + '%'}
          tick={axisStyle}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
        />
        <Tooltip content={<CustomTooltip isPercent={true} />} cursor={{ fill: 'rgba(37,99,235,0.04)' }} />
        <Legend
          verticalAlign="top"
          wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#475569' }}
        />
        <Bar dataKey={`${d1} (%)`} stackId="a" fill={C1} radius={[0, 0, 0, 0]} />
        <Bar dataKey={`${d2} (%)`} stackId="a" fill={C2} />
        <Bar dataKey="Unmapped (%)" stackId="a" fill={C3} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
