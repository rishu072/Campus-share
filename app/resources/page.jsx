'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useMe } from '../../lib/useMe'

const TYPES = ['lab', '3d_printer', 'camera', 'room']
const EMPTY = { name: '', type: '3d_printer', location: '', rules: '', max_hours_per_week: 8, req: '' }

export default function Resources() {
  const { me, profile } = useMe(true)
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [form, setForm] = useState(EMPTY)
  const set = k => e => setForm({ ...form, [k]: e.target.value })

  const load = async () => {
    let query = supabase.from('resources').select('*, requirements(label)').order('created_at', { ascending: false })
    if (type) query = query.eq('type', type)
    if (q) query = query.ilike('name', `%${q}%`)
    const { data } = await query
    setItems(data || [])
  }
  useEffect(() => { load() }, [q, type])

  const create = async e => {
    e.preventDefault()
    const { req, ...r } = form
    const { data, error } = await supabase.from('resources').insert({ ...r, owner_id: me.id }).select().single()
    if (error) return alert(error.message)
    const labels = req.split(',').map(s => s.trim()).filter(Boolean)
    if (labels.length) await supabase.from('requirements').insert(labels.map(label => ({ resource_id: data.id, label })))
    setForm(EMPTY)
    load()
  }

  return (
    <>
      <h2>Resources</h2>
      <input placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} />
      <select value={type} onChange={e => setType(e.target.value)}>
        <option value="">All types</option>
        {TYPES.map(t => <option key={t}>{t}</option>)}
      </select>
      {items.map(r => (
        <div className="card" key={r.id}>
          <Link href={`/resources/${r.id}`}><b>{r.name}</b></Link> <span className="badge">{r.type}</span>
          <div>{r.location}</div>
          <div>Requires: {r.requirements.map(x => x.label).join(', ') || 'nothing'}</div>
        </div>
      ))}
      {profile?.role === 'owner' && (
        <form className="card" onSubmit={create}>
          <h3>List a resource</h3>
          <input placeholder="Name" value={form.name} onChange={set('name')} required />
          <select value={form.type} onChange={set('type')}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
          <input placeholder="Location" value={form.location} onChange={set('location')} />
          <input placeholder="Rules" value={form.rules} onChange={set('rules')} />
          <input type="number" min="1" value={form.max_hours_per_week} onChange={set('max_hours_per_week')} title="Max hours per user per week" />
          <input placeholder="Requirements (comma separated)" value={form.req} onChange={set('req')} />
          <button>Create</button>
        </form>
      )}
    </>
  )
}
