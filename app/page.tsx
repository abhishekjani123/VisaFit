'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import VerdictCard from '@/components/VerdictCard'
import type { VerdictResult } from '@/lib/types'

const HISTORY_KEY = 'visafit_history'
const MAX_HISTORY = 20

interface ResumeUploaderProps {
    label: string
    optional?: boolean
    value: string
    onChange: (text: string) => void
}

function ResumeUploader({ label, optional, value, onChange }: ResumeUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const [filename, setFilename] = useState('')
    const [uploadError, setUploadError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (file: File) => {
        if (file.type !== 'application/pdf') {
            setUploadError('Only PDF files are supported')
            return
        }
        setUploading(true)
        setUploadError('')
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch('/api/parse-resume', { method: 'POST', body: fd })
            const data = await res.json()
            if (!res.ok) {
                setUploadError(data.error ?? 'Failed to parse PDF')
            } else {
                onChange(data.text)
                setFilename(file.name)
            }
        } catch {
            setUploadError('Network error while parsing PDF')
        } finally {
            setUploading(false)
        }
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }

    const handleClear = () => {
        onChange('')
        setFilename('')
        setUploadError('')
        if (inputRef.current) inputRef.current.value = ''
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{label}</span>
                {optional && <span className="text-xs text-gray-400">(optional)</span>}
            </div>

            {value ? (
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-green-700 dark:text-green-300 truncate">
                            {filename || 'Resume loaded'}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                            {value.length.toLocaleString()} characters extracted
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="shrink-0 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                        Remove
                    </button>
                </div>
            ) : (
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => inputRef.current?.click()}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-8 flex flex-col items-center gap-2 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                >
                    {uploading ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Extracting text…</p>
                    ) : (
                        <>
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Drop PDF here or <span className="text-blue-500 font-medium">click to upload</span>
                            </p>
                        </>
                    )}
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                }}
            />

            {uploadError && (
                <p className="text-xs text-red-500 dark:text-red-400">{uploadError}</p>
            )}
        </div>
    )
}

export default function Home() {
    const [jd, setJd] = useState('')
    const [resumeA, setResumeA] = useState('')
    const [resumeB, setResumeB] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<VerdictResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const resultRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setResumeA(localStorage.getItem('visafit_resume_a') ?? '')
        setResumeB(localStorage.getItem('visafit_resume_b') ?? '')
    }, [])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jd, resumeA, resumeB }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error ?? 'Something went wrong')
                return
            }

            setResult(data)

            const raw = localStorage.getItem(HISTORY_KEY)
            const history: Array<{ result: VerdictResult; timestamp: string; jdSnippet: string }> = raw ? JSON.parse(raw) : []
            history.unshift({ result: data, timestamp: new Date().toISOString(), jdSnippet: jd.slice(0, 120) })
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))

            setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            {/* Nav */}
            <nav className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
                    <span className="text-lg font-bold tracking-tight">VisaFit</span>
                    <div className="flex gap-5 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <Link href="/resumes" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            Resumes
                        </Link>
                        <Link href="/history" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            History
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
                {/* Hero */}
                <div>
                    <h1 className="text-3xl font-bold sm:text-4xl">Should you burn a credit on this job?</h1>
                    <p className="mt-2 text-gray-500 dark:text-gray-400 text-base">
                        Paste a job description and upload your resumes. VisaFit checks H-1B sponsorship history,
                        ghost job signals, and resume fit — so you apply with confidence, not hope.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* JD */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="jd">
                            Paste job description
                        </label>
                        <textarea
                            id="jd"
                            value={jd}
                            onChange={(e) => setJd(e.target.value)}
                            rows={10}
                            placeholder="Paste the full job description here…"
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        />
                    </div>

                    {/* Resumes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ResumeUploader
                            label="Resume A"
                            value={resumeA}
                            onChange={setResumeA}
                        />
                        <ResumeUploader
                            label="Resume B"
                            optional
                            value={resumeB}
                            onChange={setResumeB}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={!jd.trim() || !resumeA.trim() || loading}
                        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors"
                    >
                        {loading ? 'Analyzing…' : 'Analyze (costs 1 credit)'}
                    </button>
                </form>

                {/* Result */}
                {result && (
                    <div ref={resultRef}>
                        <VerdictCard result={result} />
                    </div>
                )}
            </main>
        </div>
    )
}
