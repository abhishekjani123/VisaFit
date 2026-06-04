'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ResumesPage() {
    const [resumeA, setResumeA] = useState('')
    const [resumeB, setResumeB] = useState('')
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        setResumeA(localStorage.getItem('visafit_resume_a') ?? '')
        setResumeB(localStorage.getItem('visafit_resume_b') ?? '')
    }, [])

    const handleSave = () => {
        localStorage.setItem('visafit_resume_a', resumeA)
        localStorage.setItem('visafit_resume_b', resumeB)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
                <div>
                    <Link
                        href="/"
                        className="text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        ← Back
                    </Link>
                </div>

                <div>
                    <h1 className="text-2xl font-bold sm:text-3xl">Your Resumes</h1>
                    <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
                        Paste your resumes here. They are stored locally in your browser — never sent to any
                        server except when you run an analysis.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(['A', 'B'] as const).map((r) => {
                        const value = r === 'A' ? resumeA : resumeB
                        const setter = r === 'A' ? setResumeA : setResumeB
                        return (
                            <div key={r} className="space-y-1.5">
                                <label className="text-sm font-medium" htmlFor={`resume${r}`}>
                                    Resume {r}{' '}
                                    {r === 'B' && (
                                        <span className="font-normal text-gray-400">(optional)</span>
                                    )}
                                </label>
                                <textarea
                                    id={`resume${r}`}
                                    value={value}
                                    onChange={(e) => setter(e.target.value)}
                                    rows={20}
                                    placeholder={`Paste Resume ${r} text…`}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                />
                            </div>
                        )
                    })}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 text-sm transition-colors"
                    >
                        {saved ? 'Saved!' : 'Save'}
                    </button>
                    {saved && (
                        <span className="text-sm text-green-600 dark:text-green-400">
                            Resumes saved to your browser.
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
