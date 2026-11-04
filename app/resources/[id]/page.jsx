'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useMe } from '../../../lib/useMe'

export default function Resource() {
  const { id } = useParams()
  const router = useRouter()
  const { me } = useMe(true)
  const [r, setR] = useState(null)
  const [creds, setCreds] = useState([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    const { data } = await supabase.from('resources').select('*, requirements(label), profiles(name)').eq('id', id).single()
    setR(data)
    const { data: c } = await supabase.from('credentials').select('*').eq('user_id', me.id)
    setCreds(c || [])
  }
  useEffect(() => { if (me) load() }, [me])

  const statusOf = label => creds.find(c => c.label === label)?.status
  const claim = async label => {
    await supabase.from('credentials').insert({ user_id: me.id, label })
    load()
  }
  const submit = async e => {
    e.preventDefault()
    setErr('')
    const { error } = await supabase.rpc('request_booking', {
      p_resource: id,
      p_start: new Date(start).toISOString(),
      p_end: new Date(end).toISOString(),
    })
    if (error) setErr(error.message)
    else router.push('/bookings')
  }

  if (!r) return null
  const eligible = r.requirements.every(q => statusOf(q.label) === 'verified')

  return (
    <>
      <h2>{r.name} <span className="badge">{r.type}</span></h2>
      <div>Owner: {r.profiles?.name} | Location: {r.location}</div>
      <div>Rules: {r.rules || 'none'}</div>
      <div>Weekly cap per user: {r.max_hours_per_week} hours</div>

      <div className="card">
        <h3>Am I eligible? {eligible ? 'Yes' : 'Not yet'}</h3>
        {r.requirements.length === 0 && <div>No requirements.</div>}
        {r.requirements.map(q => {
          const s = statusOf(q.label)
          return (
            <div key={q.label}>
              {s === 'verified' ? 'PASS' : s === 'pending' ? 'PENDING' : 'MISSING'}: {q.label}
              {!s && <button onClick={() => claim(q.label)}>Request verification</button>}
            </div>
          )
        })}
      </div>

      <form className="card" onSubmit={submit}>
        <h3>Request booking</h3>
        <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required />
        <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required />
        <button>Submit request</button>
        {err && <div className="err">{err}</div>}
      </form>
    </>
  )
}
