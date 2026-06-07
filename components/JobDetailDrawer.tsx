'use client'

import { useState } from 'react'
import SignalBadge from './SignalBadge'
import type { JobEvidence, StaffingType, VisaRecommendedAction } from '@/lib/types'
import { buildRecruiterQuestion } from '@/lib/visa-ui-utils'

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

interface Props {
  job: JobRow
  onClose: () => void
  onStatusChange: (jobId: string, status: string) => void
}

function parseEvidence(raw: string | null): JobEvidence | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as JobEvidence
  } catch {
    return null
  }
}

const ACTION_LABELS: Record<VisaRecommendedAction, string> = {
  apply: 'Good to apply',
  ask_recruiter: 'Ask recruiter first',
  skip: 'Skip this role',
}

const CLASS_LABELS: Record<string, string> = {
  explicit_yes: 'Explicit yes',
  likely_yes: 'Likely yes',
  silent: 'Silent',
  ambiguous: 'Ambiguous',
  likely_no: 'Likely no',
  explicit_no: 'Explicit no',
}

const STAFFING_TYPE_LABELS: Record<StaffingType, string> = {
  direct: 'Direct hire',
  staffing: 'Staffing agency',
  consultancy: 'Consultancy',
  body_shop: 'Body shop',
}

export default function JobDetailDrawer({ job, onClose, onStatusChange }: Props) {
  const [coverLetter, setCoverLetter] = useState<{ letter: string; usedFromResume: string[]; usedFromJd: string[] } | null>(null)
  const [notes, setNotes] = useState<Record<string, { note: string; charCount: number; usedFromResume: string[]; usedFromJd: string[] }>>({})
  const [deepEvidence, setDeepEvidence] = useState<{ matchedPoints: string[]; gaps: string[]; reasoning: string } | null>(null)
  const [loading, setLoading] = useState('')
  const [copied, setCopied] = useState(false)
  const [showRegexHits, setShowRegexHits] = useState(false)

  const evidence = parseEvidence(job.evidence_json)
  const employer = evidence?.employer
  const jdVisa = evidence?.jdVisa
  const verdict = evidence?.verdict
  const ghostStaffing = evidence?.ghostStaffing
  const legacyLca = evidence?.lca

  const recruiterQuestion = buildRecruiterQuestion(job.title, job.company)

  const copyRecruiterQuestion = async () => {
    await navigator.clipboard.writeText(recruiterQuestion)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const generate = async (endpoint: string, body: Record<string, unknown>, setter: (d: unknown) => void) => {
    setLoading(endpoint)
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (res.ok) setter(data)
    } finally {
      setLoading('')
    }
  }

  const sponsorshipHits = (evidence?.prepass?.hits ?? []).filter(
    (h) => h.category === 'sponsorship_yes' || h.category === 'sponsorship_no',
  )
  const regexHits = ghostStaffing?.regexHits ?? (evidence?.prepass?.hits ?? []).filter(
    (h) => h.category === 'ghost' || h.category === 'staffing' || h.category === 'consultancy',
  )
  const ghostSignal = ghostStaffing?.ghostSignal ?? job.ghost_risk
  const staffingSignal = ghostStaffing?.staffingSignal ?? (job.staffing_score >= 60 ? 'red' : job.staffing_score >= 30 ? 'yellow' : 'green')

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="font-bold text-lg">{job.title}</h2>
            <p className="text-sm text-slate-500">{job.company} · {job.location}</p>
          </div>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400">Application status</label>
            <select
              value={job.status}
              onChange={(e) => onStatusChange(job.id, e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {['interested', 'applied', 'interviewing', 'rejected', 'offer'].map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {verdict ? (
              <SignalBadge signal={verdict.summarySignal} label={verdict.summaryLabel} />
            ) : (
              <SignalBadge signal={job.visa_signal} label={job.visa_summary ?? `Visa ${job.visa_signal}`} />
            )}
            <SignalBadge signal={ghostSignal} label={`Ghost ${ghostSignal}`} />
            {ghostStaffing && ghostStaffing.staffingType !== 'direct' && (
              <SignalBadge
                signal={staffingSignal}
                label={STAFFING_TYPE_LABELS[ghostStaffing.staffingType]}
              />
            )}
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              Fit: {Math.round(job.fit_score)}/100 · {job.best_resume_name ?? 'No resume'}
            </span>
            {(verdict?.confidence ?? job.visa_confidence) != null && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {verdict?.confidence ?? job.visa_confidence}% confident
              </span>
            )}
          </div>

          {verdict && (
            <section className="card p-4 space-y-3 border-2 border-blue-100 bg-blue-50/30">
              <h3 className="font-semibold text-sm text-blue-900">Visa verdict</h3>
              <p className="text-sm text-slate-800">{verdict.headline}</p>
              <p className="text-xs font-medium text-blue-700">{ACTION_LABELS[verdict.recommendedAction]}</p>
              {verdict.conflictNote && (
                <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">{verdict.conflictNote}</p>
              )}
              {verdict.recommendedAction === 'ask_recruiter' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Suggested recruiter message:</p>
                  <p className="text-xs bg-white rounded-lg border border-slate-200 p-3 text-slate-700">{recruiterQuestion}</p>
                  <button type="button" onClick={copyRecruiterQuestion} className="btn-secondary text-xs">
                    {copied ? 'Copied!' : 'Copy question for recruiter'}
                  </button>
                </div>
              )}
            </section>
          )}

          {(employer || legacyLca) && (
            <section className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm">Employer H-1B history</h3>
                {employer && (
                  <SignalBadge signal={employer.employerSignal} label={`Employer ${employer.employerSignal}`} />
                )}
              </div>
              <p className="text-sm text-slate-600">{employer?.employerSummary ?? legacyLca?.reason}</p>
              {employer && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>Score: {employer.employerScore}/100</span>
                  <span>Recent filings: {employer.recentFilings}</span>
                  <span>Trend: {employer.trend}</span>
                  {employer.approvalRate != null && <span>USCIS approval: {employer.approvalRate}%</span>}
                  <span className="capitalize">Match: {employer.matchConfidence}</span>
                </div>
              )}
              {(employer?.filings ?? legacyLca?.filings) && Object.keys(employer?.filings ?? legacyLca?.filings ?? {}).length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {Object.entries((employer?.filings ?? legacyLca?.filings) as Record<string, number>).map(([fy, count]) => (
                    <span key={fy} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{fy.replace('FY', '')}: {count}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 italic">{employer?.caveat ?? legacyLca?.caveat}</p>
              <div className="flex flex-col gap-1">
                {(employer?.validationLinks ?? legacyLca?.validationLinks ?? []).map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    ↗ {link.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          {jdVisa && (
            <section className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm">JD visa language</h3>
                <SignalBadge signal={jdVisa.jdSignal} label={CLASS_LABELS[jdVisa.classification] ?? jdVisa.classification} />
              </div>
              <p className="text-sm text-slate-600">{jdVisa.reasoning}</p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span>JD score: {jdVisa.jdScore}/100</span>
                <span>LLM confidence: {jdVisa.confidence}%</span>
                {jdVisa.llmFallback && <span className="text-amber-700">Regex fallback (LLM unavailable)</span>}
              </div>
              {jdVisa.workAuthRequired.length > 0 && (
                <p className="text-xs text-slate-600">Work auth mentioned: {jdVisa.workAuthRequired.join(', ')}</p>
              )}
              {jdVisa.evidenceQuotes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500">Quotes from JD:</p>
                  {jdVisa.evidenceQuotes.map((q) => (
                    <p key={q} className="text-xs text-slate-700 bg-slate-50 rounded px-2 py-1 border-l-2 border-blue-300">&quot;{q}&quot;</p>
                  ))}
                </div>
              )}
              {sponsorshipHits.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-semibold text-slate-500">Regex sponsorship hits:</p>
                  {sponsorshipHits.map((hit, i) => (
                    <p key={`${hit.label}-${i}`} className="text-xs text-slate-600">
                      <span className="font-medium">{hit.label}</span> — &quot;{hit.matchedText}&quot;
                    </p>
                  ))}
                </div>
              )}
            </section>
          )}

          {(ghostStaffing || evidence?.prepass) && (
            <section className="card p-4 space-y-3">
              <h3 className="font-semibold text-sm">Ghost & staffing analysis</h3>
              {ghostStaffing ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <SignalBadge signal={ghostStaffing.ghostSignal} label={`Ghost ${ghostStaffing.ghostSignal}`} />
                    <SignalBadge signal={ghostStaffing.staffingSignal} label={STAFFING_TYPE_LABELS[ghostStaffing.staffingType]} />
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {ghostStaffing.confidence}% confident
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{ghostStaffing.reasoning}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Ghost score: {ghostStaffing.ghostScore}/100</span>
                    <span>Staffing score: {ghostStaffing.staffingScore}/100</span>
                    {ghostStaffing.llmFallback && <span className="text-amber-700">Regex/metadata fallback</span>}
                  </div>
                  {ghostStaffing.metaSignals.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500">LinkedIn metadata:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ghostStaffing.metaSignals.map((s) => (
                          <span key={s} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-800 ring-1 ring-purple-100">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ghostStaffing.evidenceQuotes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-500">Evidence from JD:</p>
                      {ghostStaffing.evidenceQuotes.map((q) => (
                        <p key={q} className="text-xs text-slate-700 bg-amber-50 rounded px-2 py-1 border-l-2 border-amber-300">&quot;{q}&quot;</p>
                      ))}
                    </div>
                  )}
                  {regexHits.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowRegexHits(!showRegexHits)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {showRegexHits ? 'Hide' : 'Show'} regex pattern matches ({regexHits.length})
                      </button>
                      {showRegexHits && (
                        <ul className="mt-2 space-y-1">
                          {regexHits.map((hit, i) => (
                            <li key={`${hit.label}-${i}`} className="text-xs text-slate-600">
                              <span className="font-medium text-amber-800">{hit.label}</span>
                              {' '}(+{hit.weight}, {hit.category})
                              {hit.matchedText && <> — &quot;{hit.matchedText}&quot;</>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    Ghost score: {evidence?.prepass?.ghostScore ?? job.ghost_score}/100 ·
                    Staffing: {evidence?.prepass?.staffingScore ?? job.staffing_score}/100
                  </p>
                  {regexHits.length > 0 && (
                    <ul className="space-y-1">
                      {regexHits.map((hit, i) => (
                        <li key={`${hit.label}-${i}`} className="text-xs text-slate-600">
                          <span className="font-medium text-amber-800">{hit.label}</span>
                          {' '}(+{hit.weight})
                          {hit.matchedText && <> — &quot;{hit.matchedText}&quot;</>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}

          {evidence?.resumeMatches && (
            <section className="card p-4 space-y-2">
              <h3 className="font-semibold text-sm">Resume Match Scores</h3>
              {evidence.resumeMatches.map((m) => (
                <div key={m.slot} className="flex justify-between text-sm">
                  <span className="font-medium">{m.name}</span>
                  <span className="font-semibold">{m.score}/100</span>
                </div>
              ))}
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={!!loading}
              onClick={() => generate('/api/coverletter', { jobId: job.id, type: 'evidence' }, setDeepEvidence as (d: unknown) => void)}
            >
              {loading === '/api/coverletter' ? '…' : 'Deep match evidence'}
            </button>
            <button
              className="btn-secondary"
              disabled={!!loading}
              onClick={() => generate('/api/coverletter', { jobId: job.id }, setCoverLetter as (d: unknown) => void)}
            >
              Generate cover letter
            </button>
          </div>

          {deepEvidence && (
            <section className="card p-4 space-y-2">
              <h3 className="font-semibold text-sm">Why this resume fits</h3>
              <p className="text-sm text-slate-600">{deepEvidence.reasoning}</p>
              <div>
                <p className="text-xs font-semibold text-emerald-700">Matched:</p>
                {deepEvidence.matchedPoints.map((p) => <p key={p} className="text-xs text-slate-600">✓ {p}</p>)}
              </div>
              <div>
                <p className="text-xs font-semibold text-red-600">Gaps:</p>
                {deepEvidence.gaps.map((g) => <p key={g} className="text-xs text-slate-600">· {g}</p>)}
              </div>
            </section>
          )}

          {coverLetter && (
            <section className="card p-4 space-y-2">
              <h3 className="font-semibold text-sm">Cover Letter</h3>
              <p className="text-sm whitespace-pre-wrap">{coverLetter.letter}</p>
              <p className="text-xs text-slate-400">Used from resume: {coverLetter.usedFromResume.join('; ')}</p>
              <p className="text-xs text-slate-400">Used from JD: {coverLetter.usedFromJd.join('; ')}</p>
            </section>
          )}

          <section className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm">LinkedIn Connection Notes (≤278 chars)</h3>
            {(['hiring_manager', 'founder', 'peer'] as const).map((cat) => (
              <div key={cat}>
                <button
                  className="btn-secondary text-xs"
                  disabled={!!loading}
                  onClick={() =>
                    generate('/api/notes', { jobId: job.id, category: cat }, (d) =>
                      setNotes((prev) => ({ ...prev, [cat]: d as typeof notes[string] })),
                    )
                  }
                >
                  {cat === 'hiring_manager' ? 'Hiring manager' : cat === 'founder' ? 'Founder/exec' : 'Peer/employee'}
                </button>
                {notes[cat] && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3">
                    <p className="text-sm">{notes[cat].note}</p>
                    <p className="text-xs text-slate-400 mt-1">{notes[cat].charCount}/278 chars</p>
                  </div>
                )}
              </div>
            ))}
          </section>

          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
              Open on LinkedIn →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
