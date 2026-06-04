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

const trendLabel = (trend: VerdictResult['visaTrend']) =>
    trend.charAt(0).toUpperCase() + trend.slice(1)

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

export default function VerdictCard({ result }: { result: VerdictResult }) {
    const [copied, setCopied] = useState(false)

    const verdictLabel =
        result.verdict === 'green'
            ? `🟢 Apply — use Resume ${result.recommended === 'neither' ? 'A' : result.recommended}`
            : result.verdict === 'yellow'
              ? '🟡 Apply with caution'
              : '🔴 Skip — save your credit'

    const handleCopy = () => {
        if (result.roundOneQuestion) {
            navigator.clipboard.writeText(result.roundOneQuestion)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const showResumeB = result.resumeB.score > 0

    return (
        <div className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm">
            {/* Header */}
            <div>
                <div className={`inline-block rounded-xl px-4 py-2 text-lg font-bold ${colorClasses[result.verdict].bg} ${colorClasses[result.verdict].text}`}>
                    {verdictLabel}
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{result.reason}</p>
            </div>

            <hr className="border-gray-100 dark:border-gray-800" />

            {/* Visa Signal */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                    Sponsorship Signal
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge color={result.visaSignal}>{trendLabel(result.visaTrend)}</Badge>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{result.visaTrendReason}</p>
                <LCABarChart lcaYears={result.lcaYears} />
                {result.roundOneQuestion && (
                    <div className="mt-3 flex items-start gap-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-3">
                        <p className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">{result.roundOneQuestion}</p>
                        <button
                            onClick={handleCopy}
                            className="shrink-0 rounded px-2 py-1 text-xs font-medium bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors"
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                )}
            </div>

            <hr className="border-gray-100 dark:border-gray-800" />

            {/* Ghost Risk */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                    Job Posting Risk
                </p>
                <Badge color={result.ghostRisk}>{ghostLabels[result.ghostRisk]}</Badge>
                {result.ghostFlags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {result.ghostFlags.map((flag) => (
                            <span
                                key={flag}
                                className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs text-gray-600 dark:text-gray-300"
                            >
                                {flag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <hr className="border-gray-100 dark:border-gray-800" />

            {/* Resume Comparison */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
                    Resume Match
                </p>
                <div className={`grid gap-4 ${showResumeB ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
                    {(['A', 'B'] as const).filter((r) => r === 'A' || showResumeB).map((r) => {
                        const data = r === 'A' ? result.resumeA : result.resumeB
                        const isRecommended = result.recommended === r
                        return (
                            <div
                                key={r}
                                className={`rounded-xl p-4 border-2 transition-colors ${
                                    isRecommended
                                        ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950'
                                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                                }`}
                            >
                                <div className="flex items-baseline gap-1 mb-2">
                                    <span className={`text-3xl font-bold ${isRecommended ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                        {data.score}
                                    </span>
                                    <span className="text-sm text-gray-400">/ 100</span>
                                    <span className="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400">
                                        Resume {r} {isRecommended && '★'}
                                    </span>
                                </div>
                                {data.pros && data.pros.length > 0 && (
                                    <ul className="space-y-1 mb-2">
                                        {data.pros.map((pro) => (
                                            <li key={pro} className="text-xs text-green-700 dark:text-green-400 flex gap-1">
                                                <span>✓</span>
                                                <span>{pro}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {data.gaps.length > 0 && (
                                    <ul className="space-y-1">
                                        {data.gaps.map((gap) => (
                                            <li key={gap} className="text-xs text-gray-500 dark:text-gray-400 flex gap-1">
                                                <span>·</span>
                                                <span>{gap}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {data.gaps.length === 0 && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500">No gaps identified</p>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
