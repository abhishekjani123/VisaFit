'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import ResumeUploadPanel from '@/components/ResumeUploadPanel'
import ResumeProfileCard from '@/components/ResumeProfileCard'
import type { ResumeProfile } from '@/lib/resume-profile'

interface SavedResume {
  slot: number
  name: string
  filename: string | null
  profile: ResumeProfile
  content: string
  id?: string
}

const DEFAULT_SLOT_NAMES: Record<number, string> = {
  1: 'Primary',
  2: 'Backend focus',
  3: 'Full-stack',
  4: 'Data / ML',
  5: 'Custom',
}

export default function ResumesPage() {
  const [slots, setSlots] = useState<SavedResume[]>([])
  const [slotNames, setSlotNames] = useState<Record<number, string>>(DEFAULT_SLOT_NAMES)
  const [activeSlot, setActiveSlot] = useState(1)
  const [editingName, setEditingName] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [authState, setAuthState] = useState<'checking' | 'in' | 'out'>('checking')

  const active = slots.find((s) => s.slot === activeSlot)
  const filledCount = slots.length

  useEffect(() => {
    fetch('/api/auth')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          setAuthState('out')
          return
        }
        setAuthState('in')
        return fetch('/api/resumes')
      })
      .then((r) => r?.json())
      .then((d) => {
        if (d?.slotNames) {
          setSlotNames({ ...DEFAULT_SLOT_NAMES, ...d.slotNames })
        }
        if (d?.resumes?.length) {
          setSlots(
            d.resumes.map((r: SavedResume & { profile: ResumeProfile }) => ({
              slot: r.slot,
              name: r.name,
              filename: r.filename,
              profile: r.profile,
              content: r.content,
              id: r.id,
            })),
          )
          setEditingName(d.resumes.find((r: { slot: number }) => r.slot === 1)?.name ?? d.slotNames?.[1] ?? 'Primary')
        } else {
          setShowUpload(true)
          setEditingName(d?.slotNames?.[1] ?? 'Primary')
        }
      })
      .catch(() => setAuthState('out'))
  }, [])

  const selectSlot = (slot: number) => {
    setActiveSlot(slot)
    const current = slots.find((s) => s.slot === slot)
    setEditingName(current?.name ?? slotNames[slot] ?? DEFAULT_SLOT_NAMES[slot] ?? `Slot ${slot}`)
    setShowUpload(!current)
  }

  const saveSlotName = async () => {
    const name = editingName.trim()
    if (!name) return
    setSavingName(true)
    try {
      const res = await fetch('/api/resumes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: activeSlot, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSlotNames({ ...DEFAULT_SLOT_NAMES, ...data.slotNames })
      setSlots((prev) =>
        prev.map((s) => (s.slot === activeSlot ? { ...s, name: data.name } : s)),
      )
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    } catch {
      // ignore
    } finally {
      setSavingName(false)
    }
  }

  const handleSave = async (data: { content: string; filename: string; profile: ResumeProfile }) => {
    const slotName = editingName.trim() || slotNames[activeSlot] || DEFAULT_SLOT_NAMES[activeSlot] || `Slot ${activeSlot}`
    const res = await fetch('/api/resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slot: activeSlot,
        name: slotName,
        content: data.content,
        filename: data.filename,
        profile: data.profile,
      }),
    })
    if (!res.ok) throw new Error('Save failed')
    const result = await res.json()

    const savedResume: SavedResume = {
      slot: activeSlot,
      name: result.name ?? slotName,
      filename: data.filename,
      profile: data.profile,
      content: data.content,
    }

    setSlotNames({ ...DEFAULT_SLOT_NAMES, ...result.slotNames })
    setSlots((prev) => {
      const filtered = prev.filter((s) => s.slot !== activeSlot)
      return [...filtered, savedResume].sort((a, b) => a.slot - b.slot)
    })
    setShowUpload(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleClear = async () => {
    if (!confirm(`Remove resume from "${slotNames[activeSlot]}"?`)) return
    const res = await fetch(`/api/resumes?slot=${activeSlot}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.slotNames) setSlotNames({ ...DEFAULT_SLOT_NAMES, ...data.slotNames })
    setSlots((prev) => prev.filter((s) => s.slot !== activeSlot))
    setShowUpload(true)
  }

  if (authState === 'checking') {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
  }

  if (authState === 'out') {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-md px-4 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold">Sign in to manage resumes</h1>
          <Link href="/login" className="btn-primary inline-block px-8 py-3">Sign in</Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Your Resumes</h1>
            <p className="mt-1 text-slate-500">
              Name each slot your way — the same label shows in the tracker when that resume is the best match.
            </p>
            <p className="mt-1 text-xs text-slate-400">{filledCount} of 5 slots filled</p>
          </div>
          {filledCount > 0 && (
            <Link href="/import" className="btn-primary shrink-0 text-sm">Import jobs →</Link>
          )}
        </div>

        {/* Slot tabs — labels reflect your custom names */}
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((slot) => {
            const filled = slots.some((s) => s.slot === slot)
            const isActive = activeSlot === slot
            const label = slotNames[slot] ?? DEFAULT_SLOT_NAMES[slot]
            return (
              <button
                key={slot}
                onClick={() => selectSlot(slot)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all max-w-[180px] ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : filled
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isActive ? 'bg-white/20' : filled ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100'
                }`}>
                  {filled ? '✓' : slot}
                </span>
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>

        {(saved || nameSaved) && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
            ✓ {saved ? `Resume saved to "${slotNames[activeSlot]}"` : `Slot renamed to "${slotNames[activeSlot]}"`}
          </div>
        )}

        {/* Rename slot */}
        <div className="card p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Slot {activeSlot} label
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              Used in the job tracker when this resume wins the match (e.g. &quot;Backend SWE&quot;, &quot;ML Resume&quot;)
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSlotName()}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your naming convention…"
            />
            <button
              onClick={saveSlotName}
              disabled={savingName || !editingName.trim()}
              className="btn-secondary shrink-0 px-4"
            >
              {savingName ? '…' : 'Save name'}
            </button>
          </div>
        </div>

        {active && !showUpload ? (
          <div className="space-y-4">
            <div className="card p-6">
              <ResumeProfileCard profile={active.profile} filename={active.filename ?? undefined} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowUpload(true)} className="btn-primary flex-1 py-3">
                Replace PDF
              </button>
              <button onClick={handleClear} className="btn-secondary px-4 text-red-500 hover:text-red-600">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <ResumeUploadPanel
            key={`upload-${activeSlot}`}
            onSave={handleSave}
            existingProfile={active?.profile}
            existingFilename={active?.filename ?? undefined}
            continueLabel={`Save to "${editingName.trim() || slotNames[activeSlot]}"`}
            showContinue
          />
        )}
      </main>
    </div>
  )
}
