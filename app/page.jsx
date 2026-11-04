'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', name: '', role: 'user' })
  const [err, setErr] = useState('')
  const set = k => e => setF({ ...f, [k]: e.target.value })

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: f.email,
        password: f.password,
        options: { data: { name: f.name, role: f.role } },
      })
      if (error) return setErr(error.message)
    }
    const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
    if (error) return setErr(error.message)
    window.location.href = '/resources'
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Log in' : 'Sign up'}</h2>
      {mode === 'signup' && (
        <div>
          <input placeholder="Name" value={f.name} onChange={set('name')} required />
          <select value={f.role} onChange={set('role')}>
            <option value="user">User</option>
            <option value="owner">Owner</option>
          </select>
        </div>
      )}
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
      <input type="password" placeholder="Password" value={f.password} onChange={set('password')} required minLength={6} />
      <button>{mode === 'login' ? 'Log in' : 'Create account'}</button>
      <button type="button" className="gray" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need an account?' : 'Have an account?'}
      </button>
      {err && <div className="err">{err}</div>}
    </form>
  )
}
