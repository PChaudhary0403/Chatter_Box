import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL } from '../config'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        console.log(data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        navigate('/chat')
      } else {
        setError(data.message || 'Login failed')
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
        <p className="tagline">Your conversations, beautifully organized</p>
        <form onSubmit={handleSubmit}>
          <div>
            <label className="field-label">Username</label>
            <input className="clay-input" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="clay-input" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="clay-btn clay-btn-primary auth-submit" disabled={loading}>
            {loading ? '⏳ Signing in...' : '🚀 Sign In'}
          </button>
        </form>
        <p className="auth-link">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  )
}
