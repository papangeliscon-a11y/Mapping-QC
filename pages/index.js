import { useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'

// Recharts must be dynamically imported (no SSR) because it uses browser APIs
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })

// ─── Helpers ────────────────────────────────────────────────────────────────

function normaliseName(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim()
}

function parseFlagstat(text) {
  let total = null
  let mapped = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.includes('in total')) {
      const n = parseInt(line.split('+')[0].trim(), 10)
      if (!isNaN(n)) total = n
    }
    if (line.includes(' mapped (') && !line.includes('mate mapped')) {
      const n = parseInt(line.split('+')[0].trim(), 10)
      if (!isNaN(n)) mapped = n
    }
  }
  return { total, mapped }
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString()
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(2) + '%'
}

const C1 = '#4f7cff'
const C2 = '#22d3a0'
const C3 = '#f43f5e'

// ─── Upload Zone ─────────────────────────────────────────────────────────────

function UploadZone({ label, files, onFiles }) {
  const [hover, setHover] = useState(false)

  const handleChange = (e) => {
    const newFiles = Array.from(e.target.files || [])
    onFiles(newFiles)
    e.target.value = ''
  }

  return (
    <div
      className={`upload-zone${hover ? ' active' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <input type="file" accept=".txt" multiple onChange={handleChange} />
      <div className="upload-icon">📂</div>
      <div className="upload-label">
        <strong>{label}</strong>
        Click or drag .txt flagstat files
      </div>
      {files.length > 0 && (
        <div className="file-chips">
          {files.map(f => (
            <span key={f.name} className="chip" title={f.name}>{f.name}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [name1, setName1] = useState('Dataset 1')
  const [name2, setName2] = useState('Dataset 2')
  const [files1, setFiles1] = useState([])
  const [files2, setFiles2] = useState([])
  const [tableData, setTableData] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading] = useState(false)

  const d1 = name1.trim() || 'Dataset 1'
  const d2 = name2.trim() || 'Dataset 2'

  const readFiles = useCallback(async (fileList) => {
    const dict = {}
    for (const f of fileList) {
      const text = await f.text()
      dict[normaliseName(f.name)] = { filename: f.name, text }
    }
    return dict
  }, [])

  const buildTable = useCallback(async () => {
    if (files1.length === 0 && files2.length === 0) return

    setLoading(true)
    const [dict1, dict2] = await Promise.all([readFiles(files1), readFiles(files2)])
    const allSamples = [...new Set([...Object.keys(dict1), ...Object.keys(dict2)])].sort()

    const rows = []
    const warns = []

    for (const sample of allSamples) {
      const e1 = dict1[sample] || null
      const e2 = dict2[sample] || null

      let total1 = null, mapped1 = null
      let total2 = null, mapped2 = null

      if (e1) {
        const r = parseFlagstat(e1.text)
        total1 = r.total; mapped1 = r.mapped
        if (total1 == null || mapped1 == null)
          warns.push(`${sample}: could not fully parse ${d1} file (${e1.filename})`)
      }
      if (e2) {
        const r = parseFlagstat(e2.text)
        total2 = r.total; mapped2 = r.mapped
        if (total2 == null || mapped2 == null)
          warns.push(`${sample}: could not fully parse ${d2} file (${e2.filename})`)
      }

      const totalReads = total1 ?? total2
      const m1 = mapped1 ?? 0
      const m2 = mapped2 ?? 0
      const totalMapped = m1 + m2
      const unmapped = totalReads != null ? Math.max(0, totalReads - totalMapped) : null

      const pct = (n, d) => (n != null && d != null && d > 0) ? n / d * 100 : null

      rows.push({
        sample,
        totalReads,
        mapped1: e1 ? mapped1 : null,
        mapped2: e2 ? mapped2 : null,
        unmapped,
        pct1: pct(mapped1, totalReads),
        pct2: pct(mapped2, totalReads),
        pctUnmapped: pct(unmapped, totalReads),
        pct2ofMapped: totalMapped > 0 ? pct(m2, totalMapped) : null,
        totalMapped,
        total1,
        total2,
        totalsMatch: (total1 != null && total2 != null) ? total1 === total2 : null,
        file1: e1 ? e1.filename : '',
        file2: e2 ? e2.filename : '',
        present1: !!e1,
        present2: !!e2,
      })
    }

    setTableData(rows)
    setWarnings(warns)
    setLoading(false)
  }, [files1, files2, d1, d2, readFiles])

  // Auto-build whenever files or names change
  useMemo(() => {
    if (files1.length > 0 || files2.length > 0) {
      buildTable()
    } else {
      setTableData(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files1, files2, name1, name2])

  const absChartData = useMemo(() => {
    if (!tableData) return []
    return tableData.map(r => ({
      name: r.sample,
      [`Mapped to ${d1}`]: r.mapped1 ?? 0,
      [`Mapped to ${d2}`]: r.mapped2 ?? 0,
      'Unmapped': r.unmapped ?? 0,
    }))
  }, [tableData, d1, d2])

  const pctChartData = useMemo(() => {
    if (!tableData) return []
    return tableData.map(r => ({
      name: r.sample,
      [`${d1} (%)`]: r.pct1 ?? 0,
      [`${d2} (%)`]: r.pct2 ?? 0,
      'Unmapped (%)': r.pctUnmapped ?? 0,
    }))
  }, [tableData, d1, d2])

  const handleExport = useCallback(async () => {
    const XLSX = await import('xlsx')

    const mainRows = tableData.map(r => ({
      Sample: r.sample,
      'Total Reads': r.totalReads,
      [`Mapped to ${d1}`]: r.mapped1,
      [`Mapped to ${d2}`]: r.mapped2,
      'Unmapped Reads': r.unmapped,
      [`${d1} (%)`]: r.pct1 != null ? +r.pct1.toFixed(4) : null,
      [`${d2} (%)`]: r.pct2 != null ? +r.pct2.toFixed(4) : null,
      'Unmapped (%)': r.pctUnmapped != null ? +r.pctUnmapped.toFixed(4) : null,
      [`${d2} % of Mapped`]: r.pct2ofMapped != null ? +r.pct2ofMapped.toFixed(4) : null,
      'Total Mapped': r.totalMapped,
      [`Total (${d1} file)`]: r.total1,
      [`Total (${d2} file)`]: r.total2,
      'Totals Match': r.totalsMatch,
      [`${d1} Filename`]: r.file1,
      [`${d2} Filename`]: r.file2,
      [`${d1} Present`]: r.present1,
      [`${d2} Present`]: r.present2,
    }))

    const absRows = absChartData
    const pctRows = pctChartData

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mainRows), 'Mapping Summary')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(absRows), 'Plot Data Absolute')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pctRows), 'Plot Data Percent')
    XLSX.writeFile(wb, 'Mapping_QC_Report.xlsx')
  }, [tableData, d1, d2, absChartData, pctChartData])

  const hasData = tableData && tableData.length > 0

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>Mapping QC Comparison</h1>
        <p>Flexible comparison of two mapping result sets</p>
      </div>

      {/* Dataset Labels */}
      <div className="card">
        <div className="section-label">Dataset Labels</div>
        <div className="name-grid">
          <div className="field">
            <label>Name for first dataset</label>
            <input value={name1} onChange={e => setName1(e.target.value)} placeholder="Dataset 1" />
          </div>
          <div className="field">
            <label>Name for second dataset</label>
            <input value={name2} onChange={e => setName2(e.target.value)} placeholder="Dataset 2" />
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="card">
        <div className="section-label">Upload Flagstat Files</div>
        <div className="upload-grid">
          <UploadZone label={`Upload ${d1} flagstat files`} files={files1} onFiles={setFiles1} />
          <UploadZone label={`Upload ${d2} flagstat files`} files={files2} onFiles={setFiles2} />
        </div>
      </div>

      {/* Info when empty */}
      {!hasData && !loading && (
        <div className="info-banner">
          Upload at least one set of .txt flagstat files to generate the report.
        </div>
      )}

      {loading && (
        <div className="info-banner">Parsing files…</div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="warn-banner">
          <strong>Parsing warnings:</strong>
          {warnings.map((w, i) => <div key={i}>– {w}</div>)}
        </div>
      )}

      {/* Table */}
      {hasData && (
        <>
          <div className="card">
            <div className="section-label">Summary Table</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sample</th>
                    <th>Total Reads</th>
                    <th>→ {d1}</th>
                    <th>→ {d2}</th>
                    <th>Unmapped</th>
                    <th>{d1} %</th>
                    <th>{d2} %</th>
                    <th>Unmapped %</th>
                    <th>{d2} % of Mapped</th>
                    <th>Totals Match</th>
                    <th>{d1} Present</th>
                    <th>{d2} Present</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(r => (
                    <tr key={r.sample}>
                      <td>{r.sample}</td>
                      <td className="td-num">{fmtNum(r.totalReads)}</td>
                      <td className="td-num">{r.present1 ? fmtNum(r.mapped1) : <span className="badge-missing">missing</span>}</td>
                      <td className="td-num">{r.present2 ? fmtNum(r.mapped2) : <span className="badge-missing">missing</span>}</td>
                      <td className="td-num">{fmtNum(r.unmapped)}</td>
                      <td className="td-num">{fmtPct(r.pct1)}</td>
                      <td className="td-num">{fmtPct(r.pct2)}</td>
                      <td className="td-num">{fmtPct(r.pctUnmapped)}</td>
                      <td className="td-num">{fmtPct(r.pct2ofMapped)}</td>
                      <td className="td-center">
                        {r.totalsMatch == null
                          ? <span className="badge-na">—</span>
                          : r.totalsMatch
                            ? <span className="badge-ok">✓</span>
                            : <span className="badge-warn">✗</span>}
                      </td>
                      <td className="td-center">
                        {r.present1 ? <span className="badge-ok">✓</span> : <span className="badge-warn">✗</span>}
                      </td>
                      <td className="td-center">
                        {r.present2 ? <span className="badge-ok">✓</span> : <span className="badge-warn">✗</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="card">
            <div className="section-label">Absolute Reads</div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={absChartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,130,255,0.1)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'rgba(180,190,230,0.55)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: 'rgba(180,190,230,0.55)', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                  <Tooltip content={<CustomTooltip isPercent={false} />} />
                  <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, fontFamily: 'IBM Plex Mono' }} />
                  <Bar dataKey={`Mapped to ${d1}`} stackId="a" fill={C1} />
                  <Bar dataKey={`Mapped to ${d2}`} stackId="a" fill={C2} />
                  <Bar dataKey="Unmapped" stackId="a" fill={C3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="section-label">Percent of Total Reads</div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pctChartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,130,255,0.1)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'rgba(180,190,230,0.55)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={v => v + '%'}
                    tick={{ fill: 'rgba(180,190,230,0.55)', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  />
                  <Tooltip content={<CustomTooltip isPercent={true} />} />
                  <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, fontFamily: 'IBM Plex Mono' }} />
                  <Bar dataKey={`${d1} (%)`} stackId="a" fill={C1} />
                  <Bar dataKey={`${d2} (%)`} stackId="a" fill={C2} />
                  <Bar dataKey="Unmapped (%)" stackId="a" fill={C3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Export */}
          <div className="card">
            <div className="section-label">Export</div>
            <button className="export-btn" onClick={handleExport}>
              ⬇ Download Excel Report
            </button>
          </div>
        </>
      )}
    </div>
  )
}
