
// File: src/components/HarborForm.jsx
// Inserts into public.harbor
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function useOptions() {
  const [students, setStudents] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const [studentsRes, staffRes] = await Promise.all([
          supabase.from('students').select('id, student_name').order('student_name', { ascending: true }),
          supabase.from('staff').select('id, "Name", "Email Address (Main)"').order('Name', { ascending: true })
        ])
        if (!isMounted) return
        if (studentsRes.error) throw studentsRes.error
        if (staffRes.error) throw staffRes.error
        setStudents(studentsRes.data ?? [])
        setStaff(staffRes.data ?? [])
      } catch (e) {
        setError(e.message ?? String(e))
      } finally {
        setLoading(false)
      }
    })()
    return () => { isMounted = false }
  }, [])

  return { students, staff, loading, error }
}

function SearchableSelect({ label, items, itemToString, onSelect, placeholder = 'Search…' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => (itemToString(it) || '').toLowerCase().includes(q));
  }, [items, query, itemToString]);

  return (
    <div className="w-full relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
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
                // prefer a stable key if you have one:
                key={it.id ?? itemToString(it) ?? idx}
                // prevent blur-before-click so the list doesn’t close early
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const label = itemToString(it);
                  onSelect(it);           // updates your form state
                  setQuery(label);        // show the chosen value
                  setOpen(false);         // close the list
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
  );
}

export default function HarborForm() {
  const { students, staff, loading, error } = useOptions()
  const [form, setForm] = useState({
    student_name: '',
    year_group: '',
    visiting_period: '',
    reason: '',
    staff_logging: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      if (!form.student_name) throw new Error('Please choose a student')
      if (!form.year_group) throw new Error('Please enter a year group')
      if (!form.visiting_period) throw new Error('Please enter a period')
      if (!form.reason) throw new Error('Please add a reason')
      if (!form.staff_logging) throw new Error('Please choose a staff member')

      const payload = {
        student_name: form.student_name,
        year_group: Number(form.year_group),
        visiting_period: Number(form.visiting_period),
        reason: form.reason,
        staff_logging: form.staff_logging
      }
      const { data, error: insertError } = await supabase
        .from('harbor')
        .insert(payload)
        .select()
        .single()
      if (insertError) throw insertError
      setMessage('Saved!')
      setForm({ student_name: '', year_group: '', visiting_period: '', reason: '', staff_logging: '' })
    } catch (e) {
      setMessage(e.message ?? String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Harbor Log</h1>
      {loading && <p className="text-gray-500">Loading options…</p>}
      {error && <p className="text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <SearchableSelect
          label="Student"
          items={students}
          itemToString={(s) => s.student_name}
          onSelect={(s) => update('student_name', s.student_name)}
        />

        <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Year Group</label>
  <select
  value={form.year_group}
  onChange={(e) => update('year_group', e.target.value)}
  className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
  <option value="" disabled>
  Select year group
  </option>
  <option value="7">7</option>
  <option value="8">8</option>
  <option value="9">9</option>
  <option value="10">10</option>
  <option value="11">11</option>
  </select>
  </div>

        <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Visiting Period</label>
  <select
  value={form.visiting_period}
  onChange={(e) => update('visiting_period', e.target.value)}
  className="w-full rounded-xl border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
  <option value="" disabled>
  Select visiting period
  </option>
  <option value="1">1</option>
  <option value="2">2</option>
  <option value="3">3</option>
  <option value="4">4</option>
  <option value="5">5</option>
  <option value="6">6</option>
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
            <option>Harbor Pass</option>
            <option>Timetable Check</option>
            <option>Uniform</option>
            <option>Medical</option>
            <option>Refusal to Attend Lesson</option>
            <option>Struggling to manage</option>
            <option>Seeking a member of staff</option>
            <option>Writing a statement</option>
            <option>Water bottle</option>
            <option>Food</option>
            <option>Other</option>
            <option>Search</option>
          </select>
        </div>

        <SearchableSelect
          label="Staff Logging"
          items={staff}
          itemToString={(t) => t.Name}
          onSelect={(t) => update('staff_logging', t.Name)}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save Harbor Entry'}
        </button>
        {message && <p className="text-sm mt-1">{message}</p>}
      </form>
    </div>
  )
}
