'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import SignalBadge from '@/components/SignalBadge'
import JobDetailDrawer from '@/components/JobDetailDrawer'
import type { StaffingType, VisaRecommendedAction } from '@/lib/types'

interface JobRow {
  id: string
  title: string | null
  company: string | null
  location: string | null
  url: string | null
  visa_signal: string | null
  visa_summary: string | null
  visa_confidence: number | null
  ghost_risk: string | null
  ghost_score: number
  staffing_score: number
  fit_score: number
  best_resume_name: string | null
  status: string
  evidence_json: string | null
  jd_text: string | null
  applied_at: string | null
}

const STAFFING_BADGE: Record<StaffingType, { label: string; className: string }> = {
  direct: { label: 'Direct', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  staffing: { label: 'Staffing', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  consultancy: { label: 'Consultancy', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  body_shop: { label: 'Body shop', className: 'bg-red-50 text-red-700 ring-red-200' },
}

function getStaffingType(job: JobRow): StaffingType | null {
  if (!job.evidence_json) return job.staffing_score >= 30 ? 'staffing' : null
  try {
    const evidence = JSON.parse(job.evidence_json)
    return evidence?.ghostStaffing?.staffingType ?? (job.staffing_score >= 30 ? 'staffing' : null)
  } catch {
    return job.staffing_score >= 30 ? 'staffing' : null
  }
}

function getRecommendedAction(job: JobRow): VisaRecommendedAction | null {
  if (!job.evidence_json) return null
  try {
    const evidence = JSON.parse(job.evidence_json)
    return evidence?.verdict?.recommendedAction ?? null
  } catch {
    return null
  }
}

function getVisaLabel(job: JobRow): string {
  if (job.visa_summary) return job.visa_summary
  try {
    const evidence = job.evidence_json ? JSON.parse(job.evidence_json) : null
    return evidence?.verdict?.summaryLabel ?? `Visa ${job.visa_signal}`
  } catch {
    return `Visa ${job.visa_signal}`
  }
}

function TrackerContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const ingestionFilter = searchParams.get('ingestion')

  const [jobs, setJobs] = useState<JobRow[]>([])
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number>; appliedByDay: Record<string, number> } | null>(null)
  const [selected, setSelected] = useState<JobRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const [filterVisa, setFilterVisa] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterGhost, setFilterGhost] = useState('')
  const [hideStaffing, setHideStaffing] = useState(false)
  const [minFit, setMinFit] = useState(0)
  const [sortBy, setSortBy] = useState<'fit' | 'visa' | 'ghost'>('fit')

  useEffect(() => {
    let cancelled = false
    const q = ingestionFilter ? `?ingestionId=${ingestionFilter}` : ''

    void (async () => {
      const [jobsRes, statsRes] = await Promise.all([
        fetch(`/api/jobs${q}`),
        fetch('/api/jobs?stats=true'),
      ])
      if (cancelled) return
      const jobsData = await jobsRes.json()
      const statsData = await statsRes.json()
      setJobs(jobsData.jobs ?? [])
      setStats(statsData)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [ingestionFilter])

  const refreshStats = async () => {
    const statsRes = await fetch('/api/jobs?stats=true')
    const statsData = await statsRes.json()
    setStats(statsData)
  }

  const handleStatusChange = async (jobId: string, status: string) => {
    await fetch('/api/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, status }),
    })
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)))
    if (selected?.id === jobId) setSelected({ ...selected, status })
    void refreshStats()
  }

  const handleClear = async () => {
    if (!confirm('Clear all tracked jobs from your account? This cannot be undone.')) return
    setClearing(true)
    try {
      const res = await fetch('/api/jobs', { method: 'DELETE' })
      if (!res.ok) return
      setJobs([])
      setStats(null)
      setSelected(null)
      router.replace('/tracker')
    } finally {
      setClearing(false)
    }
  }

  const filtered = jobs
    .filter((j) => !filterVisa || j.visa_signal === filterVisa)
    .filter((j) => !filterAction || getRecommendedAction(j) === filterAction)
    .filter((j) => !filterGhost || j.ghost_risk === filterGhost)
    .filter((j) => !hideStaffing || j.staffing_score < 30)
    .filter((j) => j.fit_score >= minFit)
    .sort((a, b) => {
      if (sortBy === 'fit') return b.fit_score - a.fit_score
      if (sortBy === 'visa') {
        const order = { green: 3, yellow: 2, red: 1 }
        return (order[b.visa_signal as keyof typeof order] ?? 0) - (order[a.visa_signal as keyof typeof order] ?? 0)
      }
      return a.ghost_score - b.ghost_score
    })

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Job Tracker</h1>
            <p className="text-slate-500 mt-1">
              {filtered.length} jobs · sorted by {sortBy}
              {ingestionFilter && ' · current import'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {jobs.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {clearing ? 'Clearing…' : 'Clear all jobs'}
              </button>
            )}
            {stats && (
              <div className="flex gap-3 flex-wrap">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize">
                    {status}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {stats && Object.keys(stats.appliedByDay).length > 0 && (
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Applications per day</h2>
            <div className="flex items-end gap-2 h-24">
              {Object.entries(stats.appliedByDay)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-14)
                .map(([day, count]) => {
                  const max = Math.max(...Object.values(stats.appliedByDay), 1)
                  const height = Math.max(8, (count / max) * 100)
                  return (
                    <div key={day} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-blue-600">{count}</span>
                      <div
                        className="w-full rounded-t bg-blue-500 transition-all"
                        style={{ height: `${height}%` }}
                        title={`${day}: ${count} applied`}
                      />
                      <span className="text-[10px] text-slate-400">{day.slice(5)}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        <div className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400">Visa signal</label>
            <select value={filterVisa} onChange={(e) => setFilterVisa(e.target.value)} className="block mt-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <option value="">All</option>
              <option value="green">Green</option>
              <option value="yellow">Yellow</option>
              <option value="red">Red</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Recommended action</label>
            <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="block mt-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <option value="">All</option>
              <option value="apply">Apply</option>
              <option value="ask_recruiter">Ask recruiter</option>
              <option value="skip">Skip</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Ghost risk</label>
            <select value={filterGhost} onChange={(e) => setFilterGhost(e.target.value)} className="block mt-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <option value="">All</option>
              <option value="green">Low</option>
              <option value="yellow">Medium</option>
              <option value="red">High</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Min fit score</label>
            <input type="number" min={0} max={100} value={minFit} onChange={(e) => setMinFit(Number(e.target.value))} className="block mt-1 w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="block mt-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <option value="fit">Fit score</option>
              <option value="visa">Sponsorship</option>
              <option value="ghost">Ghost risk</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={hideStaffing} onChange={(e) => setHideStaffing(e.target.checked)} />
            Hide staffing signals
          </label>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading jobs…</p>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-500">No jobs yet.</p>
            <a href="/import" className="btn-primary inline-block mt-4 px-6 py-2">Import LinkedIn jobs</a>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => {
              const action = getRecommendedAction(job)
              return (
                <button
                  key={job.id}
                  onClick={() => setSelected(job)}
                  className="card w-full p-4 text-left hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{job.title}</p>
                      <p className="text-sm text-slate-500">{job.company} · {job.location}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-lg font-bold text-blue-600">{Math.round(job.fit_score)}</span>
                      <span className="text-xs text-slate-400">fit score</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SignalBadge signal={job.visa_signal} label={getVisaLabel(job)} />
                    {job.visa_confidence != null && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {job.visa_confidence}% confident
                      </span>
                    )}
                    {action && (
                      <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 capitalize">
                        {action.replace('_', ' ')}
                      </span>
                    )}
                    <SignalBadge signal={job.ghost_risk} label={`Ghost ${job.ghost_risk}`} />
                    {(() => {
                      const staffingType = getStaffingType(job)
                      if (!staffingType || staffingType === 'direct') return null
                      const badge = STAFFING_BADGE[staffingType]
                      return (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${badge.className}`}>
                          {badge.label}
                        </span>
                      )
                    })()}
                    {job.staffing_score >= 30 && !getStaffingType(job) && (
                      <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
                        Staffing {job.staffing_score}
                      </span>
                    )}
                    {job.best_resume_name && (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                        Best match: {job.best_resume_name}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs capitalize text-slate-600">{job.status}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {selected && (
          <JobDetailDrawer
            job={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </main>
    </div>
  )
}

export default function TrackerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>}>
      <TrackerContent />
    </Suspense>
  )
}
