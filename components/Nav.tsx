'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface User {
  id: string
  email: string
  credits: number
}

export default function Nav() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {})
  }, [])

  const logout = async () => {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/'
  }

  const linkClass =
    'text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors'

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            VF
          </span>
          <span className="text-lg font-bold text-slate-900">VisaFit</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/import" className={linkClass}>Import</Link>
          <Link href="/tracker" className={linkClass}>Tracker</Link>
          <Link href="/resumes" className={linkClass}>Resumes</Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {user.credits >= 999_999 ? '∞ credits' : `${user.credits} credits`}
              </span>
              <button onClick={logout} className="text-xs text-slate-400 hover:text-red-500">
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
