'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import OnboardingSteps from '@/components/OnboardingSteps'
import ResumeUploadPanel from '@/components/ResumeUploadPanel'
import type { ResumeProfile } from '@/lib/resume-profile'

export default function OnboardingResumePage() {
  const router = useRouter()
  const [authState, setAuthState] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          setAuthState('out')
          return
        }
        if (d.hasResume) {
          router.replace('/import')
          return
        }
        setAuthState('in')
      })
      .catch(() => setAuthState('out'))
  }, [router])

  const handleSave = async (data: { content: string; filename: string; profile: ResumeProfile }) => {
    const res = await fetch('/api/resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot: 1,
        name: 'Primary',
        content: data.content,
        filename: data.filename,
        profile: data.profile,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error)
    }
    window.location.href = '/import'
  }

  useEffect(() => {
    if (authState === 'out') {
      window.location.href = '/login?mode=register'
    }
  }, [authState])

  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  if (authState === 'out') {
    return null
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <OnboardingSteps currentStep={2} />

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Upload your resume</h1>
          <p className="mt-2 text-slate-500">
            We&apos;ll extract your skills, experience, and links — no manual entry needed.
          </p>
        </div>

        <ResumeUploadPanel
          onSave={handleSave}
          continueLabel="Save & import LinkedIn jobs →"
        />
      </main>
    </div>
  )
}
