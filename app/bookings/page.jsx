'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMe } from '../../lib/useMe'
import BookingCard from '../../components/BookingCard'

const SEL = '*, resources!inner(name,owner_id), profiles(name)'

export default function Bookings() {
  const { me, profile } = useMe(true)
  const [mine, setMine] = useState([])
  const [incoming, setIncoming] = useState([])
  const [creds, setCreds] = useState([])

  const load = async () => {
    const a = await supabase.from('bookings').select(SEL).eq('user_id', me.id).order('created_at', { ascending: false })
    setMine(a.data || [])
    if (profile.role === 'owner') {
      const b = await supabase.from('bookings').select(SEL).eq('resources.owner_id', me.id).order('created_at', { ascending: false })
      setIncoming(b.data || [])
      const c = await supabase.from('credentials').select('*, profiles(name)').eq('status', 'pending')
      setCreds(c.data || [])
    }
  }
  useEffect(() => { if (profile) load() }, [profile])

  const verify = async id => {
    await supabase.from('credentials').update({ status: 'verified' }).eq('id', id)
    load()
  }

  return (
    <>
      {profile?.role === 'owner' && (
        <>
          <h2>Credentials to verify</h2>
          {creds.length === 0 && <div>None pending.</div>}
          {creds.map(c => (
            <div className="card" key={c.id}>
              {c.profiles?.name}: {c.label} <button onClick={() => verify(c.id)}>Verify</button>
            </div>
          ))}
          <h2>Requests for my resources</h2>
          {incoming.length === 0 && <div>None.</div>}
          {incoming.map(b => <BookingCard key={b.id} b={b} asOwner onDone={load} />)}
        </>
      )}
      <h2>My bookings</h2>
      {mine.length === 0 && <div>None.</div>}
      {mine.map(b => <BookingCard key={b.id} b={b} onDone={load} />)}
    </>
  )
}
