'use client'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useMe } from '../lib/useMe'

export default function Nav() {
  const { profile } = useMe()
  const out = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }
  return (
    <nav>
      <b>CampusShare</b>
      {profile && (
        <>
          <Link href="/resources">Resources</Link>
          <Link href="/bookings">Bookings</Link>
          <span>{profile.name} ({profile.role})</span>
          <button onClick={out}>Logout</button>
        </>
      )}
    </nav>
  )
}
