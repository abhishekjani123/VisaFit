'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import OnboardingSteps from '@/components/OnboardingSteps'

export default function ImportPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ total: number; analyzed: number; status: string; error?: string } | null>(null)
  const [authState, setAuthState] = useState<'checking' | 'in' | 'out'>('checking')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          setAuthState('out')
          return
        }
        if (!d.hasResume) {
          window.location.href = '/onboarding/resume'
          return
        }
        setAuthState('in')
      })
      .catch(() => setAuthState('out'))
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const pollProgress = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/ingest?id=${id}`)
      const data = await res.json()
      setProgress(data)
      if (data.status === 'done' || data.status === 'error') {
        if (pollRef.current) clearInterval(pollRef.current)
        if (data.status === 'done') {
          window.location.href = `/tracker?ingestion=${id}`
        }
      }
    }, 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Import failed')
        return
      }
      pollProgress(data.ingestionId)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (authState === 'out') {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-md px-4 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold">Sign in to import jobs</h1>
          <p className="text-slate-500">Create a free account with 10 credits to get started.</p>
          <Link href="/login" className="btn-primary inline-block px-8 py-3">Sign in</Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        <OnboardingSteps currentStep={3} />

        <div>
          <h1 className="text-3xl font-bold">Import LinkedIn jobs</h1>
          <p className="mt-2 text-slate-500">
            Paste your LinkedIn jobs search URL (with filters applied). We&apos;ll pull all listings and analyze each one.
            Starting a new import replaces any jobs already in your tracker.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium">LinkedIn search URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/search-results/?keywords=..."
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Apply your filters on LinkedIn first (location, experience, date posted), then copy the URL from your browser.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {progress && (
            <div className="rounded-xl bg-blue-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-blue-800 capitalize">{progress.status}…</span>
                <span className="text-blue-600">{progress.analyzed} / {progress.total} jobs</span>
              </div>
              {progress.total > 0 && (
                <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${Math.round((progress.analyzed / progress.total) * 100)}%` }}
                  />
                </div>
              )}
              {progress.error && <p className="text-xs text-red-600">{progress.error}</p>}
            </div>
          )}

          <button type="submit" disabled={!url.trim() || loading || progress?.status === 'analyzing'} className="btn-primary w-full py-3">
            {loading ? 'Starting import…' : progress?.status === 'analyzing' ? 'Analyzing…' : 'Import & analyze jobs'}
          </button>
        </form>

        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-sm">What happens next</h2>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-600">
            <li>We fetch job listings from LinkedIn&apos;s public API (no login needed)</li>
            <li>Each job description is analyzed for H-1B sponsorship, ghost/staffing signals</li>
            <li>Your saved resumes are matched — best fit picked per job</li>
            <li>Everything appears in your Tracker, sortable and filterable</li>
          </ol>
        </div>
      </main>
    </div>
  )
}
