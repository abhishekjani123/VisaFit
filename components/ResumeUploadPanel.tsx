'use client'

import { useState, useRef } from 'react'
import type { ResumeProfile } from '@/lib/resume-profile'
import ResumeProfileCard from './ResumeProfileCard'

interface Props {
  onSave: (data: { content: string; filename: string; profile: ResumeProfile }) => Promise<void>
  existingProfile?: ResumeProfile | null
  existingFilename?: string
  continueLabel?: string
  showContinue?: boolean
}

export default function ResumeUploadPanel({
  onSave,
  existingProfile,
  existingFilename,
  continueLabel = 'Save & continue',
  showContinue = true,
}: Props) {
  const [profile, setProfile] = useState<ResumeProfile | null>(existingProfile ?? null)
  const [content, setContent] = useState('')
  const [filename, setFilename] = useState(existingFilename ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported')
      return
    }
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse-resume', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to parse PDF')
        return
      }
      setContent(data.text)
      setProfile(data.profile)
      setFilename(data.filename ?? file.name)
    } catch {
      setError('Upload failed — try again')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!content.trim() || !profile) return
    setSaving(true)
    setError('')
    try {
      await onSave({ content, filename, profile })
    } catch {
      setError('Failed to save resume')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files[0]
          if (f) processFile(f)
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : profile
              ? 'border-emerald-300 bg-emerald-50/30'
              : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) processFile(f)
          }}
        />
        {uploading ? (
          <div className="space-y-2">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="text-sm font-medium text-slate-600">Analyzing your resume…</p>
          </div>
        ) : profile ? (
          <div className="space-y-1">
            <p className="text-2xl">📄</p>
            <p className="text-sm font-semibold text-emerald-700">{filename}</p>
            <p className="text-xs text-slate-500">Click or drop to replace</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-4xl">📄</p>
            <p className="text-sm font-semibold text-slate-700">Drop your resume PDF here</p>
            <p className="text-xs text-slate-400">or click to browse · we&apos;ll extract skills, experience & links</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      {/* Visual profile preview — no raw text */}
      {profile && (
        <div className="card p-6">
          <ResumeProfileCard profile={profile} filename={filename} />
        </div>
      )}

      {showContinue && profile && (
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="btn-primary w-full py-3.5 text-base"
        >
          {saving ? 'Saving…' : continueLabel}
        </button>
      )}
    </div>
  )
}
