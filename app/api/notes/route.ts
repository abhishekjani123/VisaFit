import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db/client'
import { resolveAuthUser, deductCredit } from '@/lib/auth'
import { getJobById } from '@/lib/job-analyzer'
import { buildLinkedInNotePrompt } from '@/lib/prompts'
import type { NoteCategory } from '@/lib/types'

const VALID_CATEGORIES: NoteCategory[] = ['hiring_manager', 'founder', 'peer']

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { jobId, category } = await req.json()
    if (!jobId || !category) {
      return NextResponse.json({ error: 'jobId and category required' }, { status: 400 })
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    await deductCredit(user.id)

    const job = await getJobById(user.id, jobId)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const jd = String(job.jd_text ?? '')
    const resume = String(job.best_resume_content ?? '')
    const company = String(job.company ?? '')

    if (!jd || !resume) {
      return NextResponse.json({ error: 'Job or resume data missing' }, { status: 400 })
    }

    const prompt = buildLinkedInNotePrompt(category as NoteCategory, jd, resume, company)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)

    const data = await response.json()
    const parsed = JSON.parse(data.choices[0].message.content)
    let note = String(parsed.note ?? '').trim()
    if (note.length > 278) note = note.slice(0, 275) + '...'

    return NextResponse.json({
      category,
      note,
      charCount: note.length,
      usedFromResume: parsed.usedFromResume ?? [],
      usedFromJd: parsed.usedFromJd ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate note'
    const status = message.includes('Insufficient credits') ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
