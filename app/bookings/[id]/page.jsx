'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useMe } from '../../../lib/useMe'

export default function History() {
  const { id } = useParams()
  const { me } = useMe(true)
  const [log, setLog] = useState([])
  const [reports, setReports] = useState([])

  useEffect(() => {
    if (!me) return
    supabase.from('audit_log').select('*, profiles(name)').eq('booking_id', id).order('created_at').then(r => setLog(r.data || []))
    supabase.from('condition_reports').select('*').eq('booking_id', id).order('created_at').then(r => setReports(r.data || []))
  }, [me])

  return (
    <>
      <h2>Booking history</h2>
      {log.map(l => (
        <div className="tl" key={l.id}>
          <b>{l.action}</b> by {l.profiles?.name} ({l.from_status || 'new'} to {l.to_status})
          <div>{new Date(l.created_at).toLocaleString()}</div>
          {l.reason && <div>{l.reason}</div>}
        </div>
      ))}
      <h2>Condition reports</h2>
      {reports.length === 0 && <div>None yet.</div>}
      {reports.map(c => (
        <div className="card" key={c.id}>
          <b>{c.phase}</b> {c.damage && <span className="badge overdue">DAMAGE</span>}
          <div>{c.notes}</div>
          {c.photo_url && <a href={c.photo_url} target="_blank">Photo</a>}
        </div>
      ))}
    </>
  )
}
