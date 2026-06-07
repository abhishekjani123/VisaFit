'use client'

import { useState } from 'react'
import type { VerdictResult, SignalColor } from '@/lib/types'

const colorClasses: Record<SignalColor, { text: string; bg: string; dot: string }> = {
  green: { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950', dot: 'bg-green-500' },
  yellow: { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950', dot: 'bg-yellow-500' },
  red: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950', dot: 'bg-red-500' },
}

const ghostLabels: Record<SignalColor, string> = {
  green: 'Low risk',
  yellow: 'Verify posting',
  red: 'High risk',
}

function Badge({ color, children }: { color: SignalColor; children: React.ReactNode }) {
  const c = colorClasses[color]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${c.bg} ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {children}
    </span>
  )
}

function LCABarChart({ lcaYears }: { lcaYears: Record<string, number> }) {
  const entries = Object.entries(lcaYears).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return null
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div className="flex items-end gap-2 mt-4">
      {entries.map(([year, count]) => (
        <div key={year} className="flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">{count}</span>
          <div
            className="w-8 bg-blue-400 dark:bg-blue-500 rounded-t"
            style={{ height: `${Math.max((count / max) * 48, 2)}px` }}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">{year.replace('FY', '')}</span>
        </div>
      ))}
    </div>
  )
}

export default function VerdictCard({ result, jd, resumeA }: { result: VerdictResult; jd?: string; resumeA?: string }) {
  const [copied, setCopied] = useState(false)
  const [coverLetter, setCoverLetter] = useState<string | null>(null)
  const [clLoading, setClLoading] = useState(false)

  const verdictLabel =
    result.verdict === 'green'
      ? `Apply — use Resume ${result.recommended === 'neither' ? 'A' : result.recommended}`
      : result.verdict === 'yellow'
        ? 'Apply with caution'
        : 'Skip — save your credit'

  const handleCopy = () => {
    if (result.roundOneQuestion) {
      navigator.clipboard.writeText(result.roundOneQuestion)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCoverLetter = async () => {
    if (!jd || !resumeA) return
    setClLoading(true)
    try {
      const res = await fetch('/api/coverletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd,
          resume: resumeA,
          company: result.company,
          visaContext: result.visaTrendReason,
        }),
      })
      const data = await res.json()
      if (res.ok) setCoverLetter(data.letter)
    } finally {
      setClLoading(false)
    }
  }

  const handleSaveJob = async () => {
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: result.company,
        company: result.company,
        verdict: result.verdict,
      }),
    })
  }

  const showResumeB = result.resumeB.score > 0

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div>
        <div className={`inline-block rounded-xl px-4 py-2 text-lg font-bold ${colorClasses[result.verdict].bg} ${colorClasses[result.verdict].text}`}>
          {verdictLabel}
        </div>
        <p className="mt-2 text-sm font-medium">{result.company}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{result.reason}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={handleSaveJob} className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Save to tracker
        </button>
        {jd && resumeA && (
          <button onClick={handleCoverLetter} disabled={clLoading} className="text-xs rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors disabled:opacity-50">
            {clLoading ? 'Generating…' : 'Generate cover letter'}
          </button>
        )}
      </div>

      {coverLetter && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-sm whitespace-pre-wrap">{coverLetter}</div>
      )}

      <hr className="border-gray-100 dark:border-gray-800" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Sponsorship Signal</p>
        <Badge color={result.visaSignal}>{result.visaTrend.charAt(0).toUpperCase() + result.visaTrend.slice(1)}</Badge>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{result.visaTrendReason}</p>
        {result.matchType !== 'exact' && result.matchType !== 'none' && (
          <p className="text-xs text-gray-400 mt-1">Match type: {result.matchType}</p>
        )}
        <LCABarChart lcaYears={result.lcaYears} />
        {result.medianWage && (
          <p className="text-xs text-gray-500 mt-2">Median LCA wage: ${result.medianWage.toLocaleString()}</p>
        )}
        {result.approvalRate !== null && (
          <p className="text-xs text-gray-500">USCIS approval rate: {result.approvalRate}%</p>
        )}
        <p className="text-xs text-gray-400 mt-2 italic">{result.lcaCaveat}</p>
        {result.roundOneQuestion && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-3">
            <p className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">{result.roundOneQuestion}</p>
            <button onClick={handleCopy} className="shrink-0 rounded px-2 py-1 text-xs font-medium bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Job Posting Risk</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={result.ghostRisk}>{ghostLabels[result.ghostRisk]}</Badge>
          <span className="text-xs text-gray-400">Ghost score: {result.ghostScore}/100 · Staffing: {result.staffingScore}/100</span>
        </div>
        {result.ghostFlags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {result.ghostFlags.map((flag) => (
              <span key={flag} className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                {flag}
              </span>
            ))}
          </div>
        )}
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Resume Match</p>
        <div className={`grid gap-4 ${showResumeB ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
          {(['A', 'B'] as const).filter((r) => r === 'A' || showResumeB).map((r) => {
            const data = r === 'A' ? result.resumeA : result.resumeB
            const isRecommended = result.recommended === r
            return (
              <div
                key={r}
                className={`rounded-xl p-4 border-2 ${isRecommended ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'}`}
              >
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-3xl font-bold ${isRecommended ? 'text-green-600 dark:text-green-400' : ''}`}>{data.score}</span>
                  <span className="text-sm text-gray-400">/ 100</span>
                  <span className="ml-auto text-xs font-semibold text-gray-500">Resume {r} {isRecommended && '★'}</span>
                </div>
                {data.pros?.map((pro) => (
                  <p key={pro} className="text-xs text-green-700 dark:text-green-400">✓ {pro}</p>
                ))}
                {data.gaps.map((gap) => (
                  <p key={gap} className="text-xs text-gray-500">· {gap}</p>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
