'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

const OWNER = {
  pending_review: ['approve', 'reject', 'waitlist'],
  waitlisted: ['approve', 'reject'],
  returned: ['close'],
  disputed: ['resolve'],
}
const USER = {
  pending_review: ['cancel'],
  waitlisted: ['cancel'],
  approved: ['checkin', 'cancel'],
  checked_in: ['return'],
}

export default function BookingCard({ b, asOwner, onDone }) {
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState('')
  const [damage, setDamage] = useState(false)
  const [err, setErr] = useState('')
  const overdue = b.status === 'checked_in' && new Date(b.end_time) < new Date()
  const actions = (asOwner ? OWNER : USER)[b.status] || []

  const act = async action => {
    const { error } = await supabase.rpc('transition_booking', {
      p_id: b.id,
      p_action: action,
      p_reason: asOwner ? note : null,
      p_notes: asOwner ? null : note,
      p_photo: photo || null,
      p_damage: damage,
    })
    if (error) return setErr(error.message)
    setNote(''); setPhoto(''); setDamage(false); setErr('')
    onDone()
  }

  return (
    <div className="card">
      <b>{b.resources.name}</b> <span className="badge">{b.status}</span>
      {overdue && <span className="badge overdue">OVERDUE</span>}
      <div>{new Date(b.start_time).toLocaleString()} to {new Date(b.end_time).toLocaleString()}</div>
      {asOwner && <div>Requested by {b.profiles?.name}</div>}
      {b.reason && <div>Reason: {b.reason}</div>}
      {actions.length > 0 && (
        <div>
          <input
            placeholder={asOwner ? 'Reason (required for decisions)' : 'Condition notes'}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          {!asOwner && (b.status === 'approved' || b.status === 'checked_in') && (
            <input placeholder="Photo URL (optional)" value={photo} onChange={e => setPhoto(e.target.value)} />
          )}
          {!asOwner && b.status === 'checked_in' && (
            <label><input type="checkbox" checked={damage} onChange={e => setDamage(e.target.checked)} /> Damage</label>
          )}
          <div>
            {actions.map(a => (
              <button key={a} className={['reject', 'cancel'].includes(a) ? 'red' : ''} onClick={() => act(a)}>{a}</button>
            ))}
          </div>
        </div>
      )}
      {err && <div className="err">{err}</div>}
      <Link href={`/bookings/${b.id}`}>View history</Link>
    </div>
  )
}
