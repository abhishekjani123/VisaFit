'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import VerdictCard from '@/components/VerdictCard'
import type { VerdictResult } from '@/lib/types'

interface HistoryItem {
    result: VerdictResult
    timestamp: string
    jdSnippet: string
}

const HISTORY_KEY = 'visafit_history'

const verdictEmoji: Record<string, string> = {
    green: '🟢',
    yellow: '🟡',
    red: '🔴',
}

function formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).replace(',', ' ·')
}

export default function HistoryPage() {
    const [items, setItems] = useState<HistoryItem[]>([])
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

    useEffect(() => {
        const raw = localStorage.getItem(HISTORY_KEY)
        if (raw) {
            try {
                setItems(JSON.parse(raw))
            } catch {
                setItems([])
            }
        }
    }, [])

    const handleClear = () => {
        localStorage.removeItem(HISTORY_KEY)
        setItems([])
        setExpandedIndex(null)
    }

    const toggleExpand = (index: number) => {
        setExpandedIndex((prev) => (prev === index ? null : index))
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
                <div>
                    <Link
                        href="/"
                        className="text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        ← Back
                    </Link>
                </div>

                <h1 className="text-2xl font-bold sm:text-3xl">Analysis History</h1>

                {items.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">
                        No analyses yet.{' '}
                        <Link href="/" className="text-blue-500 hover:underline">
                            Go run your first one.
                        </Link>
                    </p>
                ) : (
                    <div className="space-y-3">
                        {items.map((item, index) => {
                            const isExpanded = expandedIndex === index
                            return (
                                <div
                                    key={index}
                                    className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                                >
                                    <button
                                        onClick={() => toggleExpand(index)}
                                        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <span className="text-xl leading-none mt-0.5">
                                            {verdictEmoji[item.result.verdict] ?? '⚪'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                                <span className="font-semibold truncate">
                                                    {item.result.company || 'Unknown company'}
                                                </span>
                                                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                                                    {formatTimestamp(item.timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                                                {item.jdSnippet}
                                            </p>
                                        </div>
                                        <span className="text-gray-400 dark:text-gray-500 text-sm shrink-0 mt-0.5">
                                            {isExpanded ? '▲' : '▼'}
                                        </span>
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4">
                                            <VerdictCard result={item.result} />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {items.length > 0 && (
                    <div className="pt-2">
                        <button
                            onClick={handleClear}
                            className="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                            Clear history
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
