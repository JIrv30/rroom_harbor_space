// File: src/components/Dashboards.jsx
// Two dashboard-style pages: RelocationDashboard and HarborDashboard
// - Shows which students signed in on which days
// - Useful analytics (totals, unique students, by-year, by-period, etc.)
// - Date range filter (defaults to last 14 days)
// - CSS-only bar charts (no extra libraries)
// - CSV export of the current result set

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/* -------------------------------------------------------------
   Shared helpers
------------------------------------------------------------- */
const YEAR_OPTIONS = [7,8,9,10,11]
const PERIOD_OPTIONS = [1,2,3,4,5,6]
const REASONS = [
  'Harbor Pass',
  'Timetable Check',
  'Uniform',
  'Medical',
  'Refusal to Attend Lesson',
  'Struggling to manage',
  'Seeking a member of staff',
  'Writing a statement',
  'Water bottle',
  'Food',
  'Other',
  'Search',
]

function startOfDayISO(d){ const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString() }
function endOfDayISO(d){ const x = new Date(d); x.setHours(23,59,59,999); return x.toISOString() }
function fmtDate(d){ return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) }
function ymd(d){ const x = new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const dd=String(x.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }

function useDateRange(defaultDays=14){
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - (defaultDays-1))
  const [start, setStart] = useState(ymd(from))
  const [end, setEnd] = useState(ymd(today))
  return { start, end, setStart, setEnd }
}

function Stat({label, value, sub}){
  return (
    <div className="rounded-2xl border border-gray-200 p-4 bg-white">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function BarChart({ data, labelKey, valueKey, maxBars=8 }){
  const top = useMemo(() => {
    const arr = [...data]
    arr.sort((a,b)=>b[valueKey]-a[valueKey])
    return arr.slice(0, maxBars)
  }, [data, valueKey, maxBars])
  const maxVal = Math.max(1, ...top.map(d=>d[valueKey]||0))
  return (
    <div className="space-y-2">
      {top.map((d,i)=> (
        <div key={i} className="flex items-center gap-2">
          <div className="w-32 text-sm text-gray-700 truncate" title={d[labelKey]}>{d[labelKey]}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="h-3 bg-blue-600" style={{ width: `${(100*(d[valueKey]||0)/maxVal).toFixed(2)}%` }} />
          </div>
          <div className="w-10 text-right text-sm tabular-nums">{d[valueKey]}</div>
        </div>
      ))}
      {top.length===0 && <div className="text-sm text-gray-500">No data</div>}
    </div>
  )
}

function TrendByDay({ rows, dateField='created_at' }){
  const byDay = useMemo(()=>{
    const map = new Map()
    for (const r of rows){
      const key = ymd(r[dateField])
      map.set(key, (map.get(key)||0)+1)
    }
    return Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0]))
  }, [rows, dateField])
  const maxVal = Math.max(1, ...byDay.map(([_,v])=>v))
  return (
    <div className="space-y-1">
      {byDay.map(([d,v])=> (
        <div key={d} className="flex items-center gap-2">
          <div className="w-28 text-xs text-gray-600">{fmtDate(d)}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 bg-indigo-600" style={{ width: `${(100*v/maxVal).toFixed(2)}%` }} />
          </div>
          <div className="w-8 text-right text-xs tabular-nums">{v}</div>
        </div>
      ))}
      {byDay.length===0 && <div className="text-sm text-gray-500">No rows in range</div>}
    </div>
  )
}

function ExportCsvButton({ rows, filename }){
  function handleExport(){
    if (!rows || rows.length===0) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(',')]
    for (const r of rows){
      csv.push(headers.map(h=>{
        const val = r[h]==null? '' : String(r[h])
        if (val.includes('"') || val.includes(',') || val.includes('\n')){
          return '"'+val.replace(/"/g,'""')+'"'
        }
        return val
      }).join(','))
    }
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button onClick={handleExport} className="rounded-xl bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-sm">
      Export CSV
    </button>
  )
}

function DayStudentsTable({ rows, dateField='created_at', studentField='student_name' }){
  const grouped = useMemo(()=>{
    const map = new Map()
    for (const r of rows){
      const key = ymd(r[dateField])
      const set = map.get(key) || new Set()
      set.add(r[studentField])
      map.set(key, set)
    }
    return Array.from(map.entries()).sort((a,b)=>b[0].localeCompare(a[0])) // latest first
  }, [rows, dateField, studentField])

  return (
    <div className="overflow-auto rounded-2xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Students (unique)</th>
            <th className="p-2 text-left">Count</th>
          </tr>
        </thead>
        <tbody>
          {grouped.length===0 ? (
            <tr><td className="p-3" colSpan={3}>No data</td></tr>
          ) : grouped.map(([d,set])=>{
            const list = Array.from(set).sort()
            const preview = list.slice(0, 12).join(', ')
            const more = list.length>12 ? ` +${list.length-12} more` : ''
            return (
              <tr key={d} className="border-t">
                <td className="p-2 align-top">{fmtDate(d)}</td>
                <td className="p-2">{preview}{more}</td>
                <td className="p-2 tabular-nums">{list.length}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------------------------------------
   Relocation Dashboard
------------------------------------------------------------- */

// If your table is actually named 'r-room', change this
const RELOCATION_TABLE = 'r-room'

export function RelocationDashboard(){
  const { start, end, setStart, setEnd } = useDateRange(14)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(()=>{
    let active = true
    setLoading(true)
    ;(async ()=>{
      const { data, error } = await supabase
        .from(RELOCATION_TABLE)
        .select('id, created_at, student_name, year_group, relocation_period, teacher_relocationg')
        .gte('created_at', startOfDayISO(start))
        .lte('created_at', endOfDayISO(end))
        .order('created_at', { ascending: false })
      if (!active) return
      if (error) setError(error.message)
      setRows(data ?? [])
      setLoading(false)
    })()
    return ()=>{ active=false }
  }, [start, end])

  const stats = useMemo(()=>{
    const total = rows.length
    const students = new Set(rows.map(r=>r.student_name)).size
    const byYear = Object.fromEntries(YEAR_OPTIONS.map(y=>[y,0]))
    const byPeriod = Object.fromEntries(PERIOD_OPTIONS.map(p=>[p,0]))
    const byTeacher = new Map()
    for (const r of rows){
      if (byYear[r.year_group]!=null) byYear[r.year_group]++
      if (byPeriod[r.relocation_period]!=null) byPeriod[r.relocation_period]++
      const t = r.teacher_relocationg || 'Unknown'
      byTeacher.set(t, (byTeacher.get(t)||0)+1)
    }
    return { total, students, byYear, byPeriod, byTeacher:Array.from(byTeacher.entries()).map(([k,v])=>({label:k, value:v})) }
  }, [rows])

  const trendRows = rows

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relocation — Dashboard</h1>
          <p className="text-sm text-gray-500">Which students were logged in, by day. Date range filters below.</p>
        </div>
        <ExportCsvButton rows={rows} filename={`relocation_${start}_to_${end}.csv`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">From</label>
          <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-1.5" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">To</label>
          <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-1.5" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total entries" value={loading? '—' : stats.total} />
        <Stat label="Unique students" value={loading? '—' : stats.students} />
        <Stat label="Date range" value={`${fmtDate(start)} – ${fmtDate(end)}`} />
      </div>

      {/* Trend */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <h2 className="font-semibold mb-3">Entries per day</h2>
          {loading ? <div className="text-sm text-gray-500">Loading…</div> : <TrendByDay rows={trendRows} />}
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <h2 className="font-semibold mb-3">By teacher (top)</h2>
          {loading ? <div className="text-sm text-gray-500">Loading…</div> : <BarChart data={stats.byTeacher} labelKey="label" valueKey="value" />}
        </div>
      </section>

      {/* Breakdowns */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <h2 className="font-semibold mb-3">By year group</h2>
          {!loading && (
            <BarChart data={YEAR_OPTIONS.map(y=>({label:`Year ${y}`, value: stats.byYear[y]}))} labelKey="label" valueKey="value" />
          )}
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
        </div>
        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <h2 className="font-semibold mb-3">By period</h2>
          {!loading && (
            <BarChart data={PERIOD_OPTIONS.map(p=>({label:`P${p}`, value: stats.byPeriod[p]}))} labelKey="label" valueKey="value" />
          )}
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
        </div>
      </section>

      {/* Students by day */}
      <section className="rounded-2xl border border-gray-200 p-4 bg-white">
        <h2 className="font-semibold mb-3">Students by day (unique names)</h2>
        {loading ? <div className="text-sm text-gray-500">Loading…</div> : <DayStudentsTable rows={rows} />}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

/* -------------------------------------------------------------
   Harbor Dashboard
------------------------------------------------------------- */

export function HarborDashboard(){
  const { start, end, setStart, setEnd } = useDateRange(14)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(()=>{
    let active = true
    setLoading(true)
    ;(async ()=>{
      const { data, error } = await supabase
        .from('harbor')
        .select('id, created_at, student_name, year_group, visiting_period, reason, staff_logging')
        .gte('created_at', startOfDayISO(start))
        .lte('created_at', endOfDayISO(end))
        .order('created_at', { ascending: false })
      if (!active) return
      if (error) setError(error.message)
      setRows(data ?? [])
      setLoading(false)
    })()
    return ()=>{ active=false }
  }, [start, end])

  const stats = useMemo(()=>{
    const total = rows.length
    const students = new Set(rows.map(r=>r.student_name)).size
    const byYear = Object.fromEntries(YEAR_OPTIONS.map(y=>[y,0]))
    const byPeriod = Object.fromEntries(PERIOD_OPTIONS.map(p=>[p,0]))
    const byReason = new Map()
    const byStaff = new Map()
    for (const r of rows){
      if (byYear[r.year_group]!=null) byYear[r.year_group]++
      if (byPeriod[r.visiting_period]!=null) byPeriod[r.visiting_period]++
      byReason.set(r.reason, (byReason.get(r.reason)||0)+1)
      byStaff.set(r.staff_logging, (byStaff.get(r.staff_logging)||0)+1)
    }
    return {
      total,
      students,
      byYear,
      byPeriod,
      byReason: Array.from(byReason.entries()).map(([label,value])=>({label, value})),
      byStaff: Array.from(byStaff.entries()).map(([label,value])=>({label, value})),
    }
  }, [rows])

  const trendRows = rows

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Harbor — Dashboard</h1>
          <p className="text-sm text-gray-500">Which students visited Harbor, by day. Date range filters below.</p>
        </div>
        <ExportCsvButton rows={rows} filename={`harbor_${start}_to_${end}.csv`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">From</label>
          <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-1.5" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">To</label>
          <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-1.5" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total entries" value={loading? '—' : stats.total} />
        <Stat label="Unique students" value={loading? '—' : stats.students} />
        <Stat label="Date range" value={`${fmtDate(start)} – ${fmtDate(end)}`} />
      </div>

      {/* Trend */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <h2 className="font-semibold mb-3">Entries per day</h2>
          {loading ? <div className="text-sm text-gray-500">Loading…</div> : <TrendByDay rows={trendRows} />}
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <h2 className="font-semibold mb-3">By reason (top)</h2>
          {loading ? <div className="text-sm text-gray-500">Loading…</div> : <BarChart data={stats.byReason} labelKey="label" valueKey="value" />}
        </div>
      </section>

      {/* Breakdowns */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <h2 className="font-semibold mb-3">By year group</h2>
          {!loading && (
            <BarChart data={YEAR_OPTIONS.map(y=>({label:`Year ${y}`, value: stats.byYear[y]}))} labelKey="label" valueKey="value" />
          )}
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
        </div>
        <div className="rounded-2xl border border-gray-200 p-4 bg-white">
          <h2 className="font-semibold mb-3">By period</h2>
          {!loading && (
            <BarChart data={PERIOD_OPTIONS.map(p=>({label:`P${p}`, value: stats.byPeriod[p]}))} labelKey="label" valueKey="value" />
          )}
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
        </div>
      </section>

      {/* By staff */}
      <section className="rounded-2xl border border-gray-200 p-4 bg-white">
        <h2 className="font-semibold mb-3">By staff (top)</h2>
        {loading ? <div className="text-sm text-gray-500">Loading…</div> : <BarChart data={stats.byStaff} labelKey="label" valueKey="value" />}
      </section>

      {/* Students by day */}
      <section className="rounded-2xl border border-gray-200 p-4 bg-white">
        <h2 className="font-semibold mb-3">Students by day (unique names)</h2>
        {loading ? <div className="text-sm text-gray-500">Loading…</div> : <DayStudentsTable rows={rows} />}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
