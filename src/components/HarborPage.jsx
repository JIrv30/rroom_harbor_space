import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const YEAR_OPTIONS = [7, 8, 9, 10, 11]
const PERIOD_OPTIONS = [1, 2, 3, 4, 5, 6]
const REASONS = [
  'Harbor Pass','Timetable Check','Uniform','Medical','Refusal to Attend Lesson',
  'Struggling to manage','Seeking a member of staff','Writing a statement',
  'Water bottle','Food','Other','Search',
]

function startOfDayISO(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString() }
function startOfNextDayISO(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()+1); return x.toISOString() }
function ymd(d){ const x=new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const dd=String(x.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }
function fmtDate(d){ return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) }

function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', open)
    return () => document.body.classList.remove('overflow-hidden')
  }, [open])
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}/>
      <aside
        role="dialog" aria-modal="true" aria-label={title}
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl p-4 overflow-y-auto transform transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e)=>e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded-lg px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200" onClick={onClose}>Close</button>
        </div>
        {children}
      </aside>
    </div>
  )
}

function SearchableSelect({ label, items, itemToString, onSelect, placeholder = 'Search…' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => (itemToString(it) || '').toLowerCase().includes(q))
  }, [items, query, itemToString])
  return (
    <div className="w-full relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text" value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-10 mt-2 w-full max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white shadow">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No matches</div>
          ) : filtered.map((it, idx) => (
            <button
              type="button"
              key={it.id ?? itemToString(it) ?? idx}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { const label = itemToString(it) || ''; onSelect(it); setQuery(label); setOpen(false) }}
              className="block w-full text-left px-3 py-2 hover:bg-gray-50"
            >
              {itemToString(it)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function usePeopleOptions() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, student_name')
          .order('student_name', { ascending: true })
        if (error) throw error
        if (mounted) setStudents(data ?? [])
      } catch (e) {
        if (mounted) setError(e.message ?? String(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // no staff anymore
  return { students, loading, error }
}


function groupByDay(rows) {
  const map = new Map()
  for (const r of rows) {
    const key = ymd(r.created_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(r)
  }
  return Array.from(map.entries()).sort((a,b)=> b[0].localeCompare(a[0]))
}

export default function HarborPage() {
  const { students } = usePeopleOptions()
  const [staffName, setStaffName] = useState('')
  const [reslovingStaff, setResolvingStaff] = useState(true)
  const [todayRows, setTodayRows] = useState([])
  const [earlierRows, setEarlierRows] = useState([])
  const [loadingToday, setLoadingToday] = useState(true)
  const [loadingEarlier, setLoadingEarlier] = useState(true)
  const [showEarlier, setShowEarlier] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const initialForm = { student_name: '', year_group: '', visiting_period: '', reason: '', staff_logging: '' }
  const [form, setForm] = useState(initialForm)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    let active = true
    ;(async () => {
      setResolvingStaff(true)
      // 1) get current session/user
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { if (active) { setStaffName(''); setResolvingStaff(false) } return }

      const email = user.email || user.user_metadata?.email
      const fallback =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        email ||
        ''

      // 2) try to find a nicer display name from your staff table by email
      try {
        const { data, error } = await supabase
          .from('staff')
          .select('"Name", "Email Address (Main)"')
          .eq('Email Address (Main)', email)
          .maybeSingle()

        if (error) throw error
        const official = data?.Name?.trim()
        if (active) setStaffName(official || fallback)
      } catch {
        if (active) setStaffName(fallback)
      } finally {
        if (active) setResolvingStaff(false)
      }
    })()

    // also react to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      const u = s?.user
      if (!u) { setStaffName(''); return }
      const email = u.email || u.user_metadata?.email
      const fallback =
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        email ||
        ''
      setStaffName(fallback)
    })

    return () => subscription?.unsubscribe()
  }, [])
  

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function fetchToday() {
    setLoadingToday(true)
    const { data, error } = await supabase
      .from('harbor')
      .select('id, created_at, student_name, year_group, visiting_period, reason, staff_logging')
      .gte('created_at', startOfDayISO(new Date()))
      .lt('created_at', startOfNextDayISO(new Date()))
      .order('created_at', { ascending: false })
    if (error) setMessage(error.message)
    setTodayRows(data ?? [])
    setLoadingToday(false)
  }

  async function fetchEarlier() {
    setLoadingEarlier(true)
    const start = new Date(); start.setDate(start.getDate() - 7)
    const { data, error } = await supabase
      .from('harbor')
      .select('id, created_at, student_name, year_group, visiting_period, reason, staff_logging')
      .gte('created_at', startOfDayISO(start))
      .lt('created_at', startOfDayISO(new Date()))
      .order('created_at', { ascending: false })
    if (error) setMessage(error.message)
    setEarlierRows(data ?? [])
    setLoadingEarlier(false)
  }

  useEffect(() => { fetchToday(); fetchEarlier() }, [])

  async function handleSubmit(e) {
    e?.preventDefault?.()
    setMessage(null)
    try {
      if (!form.student_name) throw new Error('Choose a student')
      if (!form.year_group) throw new Error('Choose a year group')
      if (!form.visiting_period) throw new Error('Choose a period')
      if (!form.reason) throw new Error('Choose a reason')
      if (!staffName) throw new Error('Could not determine your staff name — are you signed in?')
      setSubmitting(true)
        const payload = {
        student_name: form.student_name,
        year_group: Number(form.year_group),
        visiting_period: Number(form.visiting_period),
        reason: form.reason,
        staff_logging: staffName
      }
      const { error } = await supabase.from('harbor').insert(payload)
      if (error) throw error
      setForm(initialForm)
      setFormKey(k=>k+1)
      setDrawerOpen(false)
      fetchToday(); fetchEarlier()
    } catch (err) { setMessage(err.message ?? String(err)) }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Harbor — Today</h1>
          <p className="text-sm text-gray-500">Showing entries from today only.</p>
        </div>
        <button
  className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold"
  onClick={() => { setForm(initialForm); setFormKey(k => k + 1); setDrawerOpen(true) }}
>
  New Harbor Entry
</button>

      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}

      {/* Today’s entries */}
      <div className="overflow-auto rounded-2xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Student</th>
              <th className="p-2 text-left">Year</th>
              <th className="p-2 text-left">Period</th>
              <th className="p-2 text-left">Reason</th>
              <th className="p-2 text-left">Staff</th>
              <th className="p-2 text-left">ID</th>
            </tr>
          </thead>
          <tbody>
            {loadingToday ? (
              <tr><td className="p-3" colSpan={7}>Loading…</td></tr>
            ) : todayRows.length === 0 ? (
              <tr><td className="p-3" colSpan={7}>No entries yet today.</td></tr>
            ) : (
              todayRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute:'2-digit' })}</td>
                  <td className="p-2">{r.student_name}</td>
                  <td className="p-2">{r.year_group}</td>
                  <td className="p-2">{r.visiting_period}</td>
                  <td className="p-2">{r.reason}</td>
                  <td className="p-2">{r.staff_logging}</td>
                  <td className="p-2 text-gray-500">{r.id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Previous days (collapsible) */}
      <details className="rounded-2xl border border-gray-200 bg-white p-4" open={showEarlier} onToggle={(e)=>setShowEarlier(e.currentTarget.open)}>
        <summary className="cursor-pointer select-none font-semibold">Previous days (last 7)</summary>
        <div className="mt-4 space-y-4">
          {loadingEarlier ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : earlierRows.length === 0 ? (
            <div className="text-sm text-gray-500">No entries in the last 7 days.</div>
          ) : (
            groupByDay(earlierRows).map(([day, list]) => (
              <div key={day} className="overflow-auto rounded-xl border border-gray-200">
                <div className="px-3 py-2 text-sm bg-gray-50 text-gray-700">{fmtDate(day)}</div>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Student</th>
                      <th className="p-2 text-left">Year</th>
                      <th className="p-2 text-left">Period</th>
                      <th className="p-2 text-left">Reason</th>
                      <th className="p-2 text-left">Staff</th>
                      <th className="p-2 text-left">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute:'2-digit' })}</td>
                        <td className="p-2">{r.student_name}</td>
                        <td className="p-2">{r.year_group}</td>
                        <td className="p-2">{r.visiting_period}</td>
                        <td className="p-2">{r.reason}</td>
                        <td className="p-2">{r.staff_logging}</td>
                        <td className="p-2 text-gray-500">{r.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </details>

      {/* Drawer with the form */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Harbor Entry">
        <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
          <SearchableSelect
            label="Student"
            items={students}
            itemToString={(s) => s?.student_name ?? ''}
            onSelect={(s) => update('student_name', s?.student_name ?? '')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year Group</label>
            <select
              value={form.year_group}
              onChange={(e) => update('year_group', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select year group</option>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visiting Period</label>
            <select
              value={form.visiting_period}
              onChange={(e) => update('visiting_period', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select period</option>
              {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              value={form.reason}
              onChange={(e) => update('reason', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select reason</option>
              {REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logged by</label>
            <input
              type="text"
              value={staffName}
              readOnly
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800"
              placeholder="Resolving your name…"
            />
            <p className="text-xs text-gray-500 mt-1">
              Captured from your sign-in details.
            </p>
          </div>
          <button type="submit" className="w-full rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold">
            {submitting ? 'Saving' : 'Save'}
          </button>
          {message && <p className='text-sm text-red-600'>{message}</p>}
        </form>
      </Drawer>
    </div>
  )
}
