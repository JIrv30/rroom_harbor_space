import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** CHANGE THIS if your table name is different */
const RELOCATION_TABLE = 'r-room' // or 'r-room'

const YEAR_OPTIONS = [7, 8, 9, 10, 11]
const PERIOD_OPTIONS = [1, 2, 3, 4, 5, 6]

/* ---------- Small UI helpers ---------- */

function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', open)
    return () => document.body.classList.remove('overflow-hidden')
  }, [open])

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl p-4 overflow-y-auto transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded-lg px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200" onClick={onClose}>
            Close
          </button>
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
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open && (
        <div className="absolute z-10 mt-2 w-full max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white shadow">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No matches</div>
          ) : (
            filtered.map((it, idx) => (
              <button
                type="button"
                key={it.id ?? itemToString(it) ?? idx}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const label = itemToString(it) || ''
                  onSelect(it)                  // update parent form state
                  setQuery(label)               // show chosen label in box
                  setOpen(false)                // close list
                }}
                className="block w-full text-left px-3 py-2 hover:bg-gray-50"
              >
                {itemToString(it)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Data hooks ---------- */

function usePeopleOptions() {
  const [students, setStudents] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [s1, s2] = await Promise.all([
          supabase.from('students').select('id, student_name').order('student_name', { ascending: true }),
          supabase.from('staff').select('id, "Name", "Email Address (Main)"').order('Name', { ascending: true })
        ])
        if (!mounted) return
        if (s1.error) throw s1.error
        if (s2.error) throw s2.error
        setStudents(s1.data ?? [])
        setStaff(s2.data ?? [])
      } catch (e) {
        setError(e.message ?? String(e))
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return { students, staff, loading, error }
}

export default function RelocationPage() {
  const { students, staff } = usePeopleOptions()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [message, setMessage] = useState(null)

  const [form, setForm] = useState({
    student_name: '',
    year_group: '',
    relocation_period: '',
    teacher_relocationg: ''
  })
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function fetchRows() {
    setLoading(true)
    const { data, error } = await supabase
      .from(RELOCATION_TABLE)
      .select('id, created_at, student_name, year_group, relocation_period, teacher_relocationg')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) setMessage(error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchRows()
  }, [])

  async function handleSubmit(e) {
    e?.preventDefault?.()
    setMessage(null)
    try {
      if (!form.student_name) throw new Error('Choose a student')
      if (!form.year_group) throw new Error('Choose a year group')
      if (!form.relocation_period) throw new Error('Choose a period')

      const payload = {
        student_name: form.student_name,
        year_group: Number(form.year_group),
        relocation_period: Number(form.relocation_period),
        teacher_relocationg: form.teacher_relocationg || null
      }
      const { error } = await supabase.from(RELOCATION_TABLE).insert(payload)
      if (error) throw error
      setDrawerOpen(false)
      setForm({ student_name: '', year_group: '', relocation_period: '', teacher_relocationg: '' })
      fetchRows()
    } catch (err) {
      setMessage(err.message ?? String(err))
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Relocation Room — Overview</h1>
          <p className="text-sm text-gray-500">
            Showing the 100 most recent entries.
          </p>
        </div>
        <button
          className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold"
          onClick={() => setDrawerOpen(true)}
        >
          New Relocation
        </button>
      </div>

      {message && <p className="mb-2 text-sm text-red-600">{message}</p>}

      <div className="overflow-auto rounded-2xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Student</th>
              <th className="p-2 text-left">Year</th>
              <th className="p-2 text-left">Period</th>
              <th className="p-2 text-left">Teacher relocating</th>
              <th className="p-2 text-left">ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={6}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={6}>No entries yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{new Date(r.created_at).toLocaleString('en-GB')}</td>
                  <td className="p-2">{r.student_name}</td>
                  <td className="p-2">{r.year_group}</td>
                  <td className="p-2">{r.relocation_period}</td>
                  <td className="p-2">{r.teacher_relocationg ?? '—'}</td>
                  <td className="p-2 text-gray-500">{r.id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add Relocation Entry">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Relocation Period</label>
            <select
              value={form.relocation_period}
              onChange={(e) => update('relocation_period', e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select period</option>
              {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <SearchableSelect
            label="Teacher Relocating"
            items={staff}
            itemToString={(t) => t?.Name ?? ''}
            onSelect={(t) => update('teacher_relocationg', t?.Name ?? '')}
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold"
          >
            Save
          </button>
        </form>
      </Drawer>
    </div>
  )
}
