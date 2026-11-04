'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useMe(required = false) {
  const [state, setState] = useState({ loading: true, me: null, profile: null })
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const me = data.user
      if (!me) {
        if (required) window.location.href = '/'
        return setState({ loading: false, me: null, profile: null })
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', me.id).single()
      setState({ loading: false, me, profile })
    })
  }, [])
  return state
}
