import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL } from '../config'

export default function SignupPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        navigate('/chat')
      } else {
        setError(data.message || 'Signup failed')
      }
    } catch {
      setError('Unable to connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card clay-card-raised">
        <div className="logo">ChatterBox</div>
        <p className="tagline">Create your account to get started</p>
        <form onSubmit={handleSubmit}>
          <div>
            <label className="field-label">Username</label>
            <input className="clay-input" placeholder="Choose a username" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="clay-input" type="password" placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Confirm Password</label>
            <input className="clay-input" type="password" placeholder="Confirm your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="clay-btn clay-btn-primary auth-submit" disabled={loading}>
            {loading ? '⏳ Creating...' : '✨ Create Account'}
          </button>
        </form>
        <p className="auth-link">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
