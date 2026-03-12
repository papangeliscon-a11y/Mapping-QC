import { useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'

const AbsChart = dynamic(() => import('../components/Charts').then(m => m.AbsChart), { ssr: false })
const PctChart = dynamic(() => import('../components/Charts').then(m => m.PctChart), { ssr: false })

function normaliseName(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim()
}

function parseFlagstat(text) {
  let total = null, mapped = null
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

function fmtM(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toString()
}

function PctBarCell({ value, color }) {
  if (value == null || isNaN(value)) return <span className="badge-na">—</span>
  const w = Math.min(100, Math.max(0, value))
  return (
    <div className="pct-bar-wrap">
      <div className="pct-bar-bg">
        <div className="pct-bar-fill" style={{ width: w + '%', background: color }} />
      </div>
      <span className="pct-bar-label">{value.toFixed(1)}%</span>
    </div>
  )
}

function UploadZone({ label, files, onFiles, color }) {
  const [hover, setHover] = useState(false)
  const handleChange = (e) => {
    onFiles(Array.from(e.target.files || []))
    e.target.value = ''
  }
  return (
    <div
      className={`upload-zone${hover ? ' active' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={hover ? { borderColor: color } : {}}
    >
      <input type="file" accept=".txt" multiple onChange={handleChange} />
      <div className="upload-icon">📂</div>
      <div className="upload-label">
        <strong style={{ color }}>{label}</strong>
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

  const buildTable = useCallback(async (f1, f2, label1, label2) => {
    setLoading(true)
    const [dict1, dict2] = await Promise.all([readFiles(f1), readFiles(f2)])
    const allSamples = [...new Set([...Object.keys(dict1), ...Object.keys(dict2)])].sort()
    const rows = [], warns = []

    for (const sample of allSamples) {
      const e1 = dict1[sample] || null
      const e2 = dict2[sample] || null
      let total1 = null, mapped1 = null, total2 = null, mapped2 = null

      if (e1) {
        const r = parseFlagstat(e1.text); total1 = r.total; mapped1 = r.mapped
        if (total1 == null || mapped1 == null) warns.push(`${sample}: could not fully parse ${label1} file (${e1.filename})`)
      }
      if (e2) {
        const r = parseFlagstat(e2.text); total2 = r.total; mapped2 = r.mapped
        if (total2 == null || mapped2 == null) warns.push(`${sample}: could not fully parse ${label2} file (${e2.filename})`)
      }

      const totalReads = total1 ?? total2
      const m1 = mapped1 ?? 0, m2 = mapped2 ?? 0
      const totalMapped = m1 + m2
      const unmapped = totalReads != null ? Math.max(0, totalReads - totalMapped) : null
      const pct = (n, d) => (n != null && d != null && d > 0) ? n / d * 100 : null

      rows.push({
        sample, totalReads,
        mapped1: e1 ? mapped1 : null,
        mapped2: e2 ? mapped2 : null,
        unmapped,
        pct1: pct(mapped1, totalReads),
        pct2: pct(mapped2, totalReads),
        pctUnmapped: pct(unmapped, totalReads),
        pct2ofMapped: totalMapped > 0 ? pct(m2, totalMapped) : null,
        totalMapped, total1, total2,
        totalsMatch: (total1 != null && total2 != null) ? total1 === total2 : null,
        file1: e1 ? e1.filename : '', file2: e2 ? e2.filename : '',
        present1: !!e1, present2: !!e2,
      })
    }
    setTableData(rows); setWarnings(warns); setLoading(false)
  }, [readFiles])

  useMemo(() => {
    if (files1.length > 0 || files2.length > 0) buildTable(files1, files2, d1, d2)
    else setTableData(null)
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

  // Summary stats
  const stats = useMemo(() => {
    if (!tableData || tableData.length === 0) return null
    const totalReads = tableData.reduce((s, r) => s + (r.totalReads ?? 0), 0)
    const totalMapped = tableData.reduce((s, r) => s + (r.totalMapped ?? 0), 0)
    const avgPct1 = tableData.filter(r => r.pct1 != null).reduce((s, r) => s + r.pct1, 0) / tableData.filter(r => r.pct1 != null).length
    const avgPct2 = tableData.filter(r => r.pct2 != null).reduce((s, r) => s + r.pct2, 0) / tableData.filter(r => r.pct2 != null).length
    return { totalReads, totalMapped, avgPct1, avgPct2, nSamples: tableData.length }
  }, [tableData])

  const handleExport = useCallback(async () => {
    const XLSX = await import('xlsx')
    const mainRows = tableData.map(r => ({
      Sample: r.sample, 'Total Reads': r.totalReads,
      [`Mapped to ${d1}`]: r.mapped1, [`Mapped to ${d2}`]: r.mapped2,
      'Unmapped Reads': r.unmapped,
      [`${d1} (%)`]: r.pct1 != null ? +r.pct1.toFixed(4) : null,
      [`${d2} (%)`]: r.pct2 != null ? +r.pct2.toFixed(4) : null,
      'Unmapped (%)': r.pctUnmapped != null ? +r.pctUnmapped.toFixed(4) : null,
      [`${d2} % of Mapped`]: r.pct2ofMapped != null ? +r.pct2ofMapped.toFixed(4) : null,
      'Total Mapped': r.totalMapped,
      [`Total (${d1} file)`]: r.total1, [`Total (${d2} file)`]: r.total2,
      'Totals Match': r.totalsMatch,
      [`${d1} Filename`]: r.file1, [`${d2} Filename`]: r.file2,
      [`${d1} Present`]: r.present1, [`${d2} Present`]: r.present2,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mainRows), 'Mapping Summary')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(absChartData), 'Plot Data Absolute')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pctChartData), 'Plot Data Percent')
    XLSX.writeFile(wb, 'Mapping_QC_Report.xlsx')
  }, [tableData, d1, d2, absChartData, pctChartData])

  const hasData = tableData && tableData.length > 0

  return (
    <div className="app">
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-icon">🧬</div>
          <span className="topbar-title">Mapping QC</span>
          <span className="topbar-subtitle">/ Comparison Tool</span>
        </div>
        <span className="topbar-badge">Flagstat Analyser</span>
      </div>

      <div className="main">
        {/* Config */}
        <div className="card">
          <div className="config-row">
            {/* Dataset names */}
            <div className="config-group">
              <div className="config-group-label">Dataset Labels</div>
              <div className="field">
                <label>First dataset name</label>
                <input value={name1} onChange={e => setName1(e.target.value)} placeholder="Dataset 1" />
              </div>
              <div className="field">
                <label>Second dataset name</label>
                <input value={name2} onChange={e => setName2(e.target.value)} placeholder="Dataset 2" />
              </div>
            </div>

            {/* Upload zones */}
            <div className="config-group">
              <div className="config-group-label">Upload Flagstat Files</div>
              <UploadZone label={`Upload ${d1} files`} files={files1} onFiles={setFiles1} color="#2563eb" />
              <UploadZone label={`Upload ${d2} files`} files={files2} onFiles={setFiles2} color="#059669" />
            </div>
          </div>
        </div>

        {!hasData && !loading && (
          <div className="info-banner">
            Upload at least one set of .txt flagstat files to generate the report.
          </div>
        )}
        {loading && <div className="info-banner">Parsing files…</div>}
        {warnings.length > 0 && (
          <div className="warn-banner">
            <strong>Parsing warnings: </strong>
            {warnings.map((w, i) => <span key={i}>{w}; </span>)}
          </div>
        )}

        {hasData && (
          <>
            {/* Stats row */}
            {stats && (
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-label">Samples</div>
                  <div className="stat-value">{stats.nSamples}</div>
                  <div className="stat-sub">total samples analysed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Reads</div>
                  <div className="stat-value">{fmtM(stats.totalReads)}</div>
                  <div className="stat-sub">across all samples</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label" style={{ color: '#2563eb' }}>
                    <span className="stat-dot" style={{ background: '#2563eb' }} />
                    Avg {d1}
                  </div>
                  <div className="stat-value">{stats.avgPct1 != null ? stats.avgPct1.toFixed(1) + '%' : '—'}</div>
                  <div className="stat-sub">mean mapping rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label" style={{ color: '#059669' }}>
                    <span className="stat-dot" style={{ background: '#059669' }} />
                    Avg {d2}
                  </div>
                  <div className="stat-value">{stats.avgPct2 != null ? stats.avgPct2.toFixed(1) + '%' : '—'}</div>
                  <div className="stat-sub">mean mapping rate</div>
                </div>
              </div>
            )}

            {/* Charts side by side */}
            <div className="charts-grid">
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">
                  <div className="card-title-icon">📊</div>
                  Absolute Reads
                </div>
                <div className="chart-wrap">
                  <AbsChart data={absChartData} d1={d1} d2={d2} />
                </div>
              </div>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-title">
                  <div className="card-title-icon">📈</div>
                  Percent of Total Reads
                </div>
                <div className="chart-wrap">
                  <PctChart data={pctChartData} d1={d1} d2={d2} />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-title">
                <div className="card-title-icon">🗂</div>
                Summary Table
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                  {tableData.length} samples
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sample</th>
                      <th style={{ textAlign: 'right' }}>Total Reads</th>
                      <th style={{ textAlign: 'right' }}>→ {d1}</th>
                      <th style={{ textAlign: 'right' }}>→ {d2}</th>
                      <th style={{ textAlign: 'right' }}>Unmapped</th>
                      <th style={{ minWidth: 130 }}>{d1} %</th>
                      <th style={{ minWidth: 130 }}>{d2} %</th>
                      <th style={{ minWidth: 130 }}>Unmapped %</th>
                      <th style={{ textAlign: 'center' }}>Totals Match</th>
                      <th style={{ textAlign: 'center' }}>{d1}</th>
                      <th style={{ textAlign: 'center' }}>{d2}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map(r => (
                      <tr key={r.sample}>
                        <td className="td-sample">{r.sample}</td>
                        <td className="td-num">{fmtNum(r.totalReads)}</td>
                        <td className="td-num">{r.present1 ? fmtNum(r.mapped1) : <span className="badge-missing">missing</span>}</td>
                        <td className="td-num">{r.present2 ? fmtNum(r.mapped2) : <span className="badge-missing">missing</span>}</td>
                        <td className="td-num">{fmtNum(r.unmapped)}</td>
                        <td><PctBarCell value={r.pct1} color="#2563eb" /></td>
                        <td><PctBarCell value={r.pct2} color="#059669" /></td>
                        <td><PctBarCell value={r.pctUnmapped} color="#dc2626" /></td>
                        <td className="td-center">
                          {r.totalsMatch == null
                            ? <span className="badge-na">—</span>
                            : r.totalsMatch
                              ? <span className="badge badge-ok">✓ Yes</span>
                              : <span className="badge badge-warn">✗ No</span>}
                        </td>
                        <td className="td-center">
                          {r.present1 ? <span className="badge badge-ok">✓</span> : <span className="badge badge-warn">✗</span>}
                        </td>
                        <td className="td-center">
                          {r.present2 ? <span className="badge badge-ok">✓</span> : <span className="badge badge-warn">✗</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export */}
            <div className="card">
              <div className="card-title">
                <div className="card-title-icon">⬇</div>
                Export
              </div>
              <div className="export-row">
                <button className="export-btn" onClick={handleExport}>
                  Download Excel Report
                </button>
                <span className="export-hint">Includes summary table and plot data — 3 sheets</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
