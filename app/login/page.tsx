'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import OnboardingSteps from '@/components/OnboardingSteps'

function LoginContent() {
  const searchParams = useSearchParams()
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login'

  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          window.location.href = d.hasResume ? '/import' : '/onboarding/resume'
        }
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Auth failed')
        return
      }
      if (data.isNewUser || !data.hasResume) {
        window.location.href = '/onboarding/resume'
      } else {
        window.location.href = '/import'
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-12">
        {mode === 'register' && <OnboardingSteps currentStep={1} />}

        <h1 className="text-2xl font-bold mb-2">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {mode === 'register'
            ? 'Step 1 of 3 — then upload your resume and import LinkedIn jobs.'
            : 'Sign in to continue your job search.'}
        </p>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account →'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500 text-center">
          {mode === 'login' ? (
            <>No account? <button onClick={() => setMode('register')} className="text-blue-600 hover:underline">Sign up free</button></>
          ) : (
            <>Have an account? <button onClick={() => setMode('login')} className="text-blue-600 hover:underline">Sign in</button></>
          )}
        </p>

        <p className="mt-6 text-center">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">← Back to home</Link>
        </p>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>}>
      <LoginContent />
    </Suspense>
  )
}
