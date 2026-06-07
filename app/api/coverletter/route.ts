import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db/client'
import { resolveAuthUser, deductCredit } from '@/lib/auth'
import { getJobById } from '@/lib/job-analyzer'
import { buildCoverLetterPrompt, buildDeepEvidencePrompt } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { jobId, type } = await req.json()
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

    await deductCredit(user.id)

    const job = await getJobById(user.id, jobId)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const jd = String(job.jd_text ?? '')
    const resume = String(job.best_resume_content ?? '')
    const company = String(job.company ?? '')
    const evidence = job.evidence_json ? JSON.parse(String(job.evidence_json)) : null
    const visaContext =
      evidence?.verdict?.headline ??
      evidence?.employer?.employerSummary ??
      evidence?.lca?.reason ??
      ''

    if (!jd || !resume) {
      return NextResponse.json({ error: 'Job or resume data missing' }, { status: 400 })
    }

    const prompt =
      type === 'evidence'
        ? buildDeepEvidencePrompt(jd, resume, company)
        : buildCoverLetterPrompt(jd, resume, company, visaContext)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: type === 'evidence' ? 600 : 800,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)

    const data = await response.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    if (type === 'evidence') {
      return NextResponse.json(parsed)
    }

    return NextResponse.json({
      letter: parsed.letter,
      usedFromResume: parsed.usedFromResume ?? [],
      usedFromJd: parsed.usedFromJd ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate'
    const status = message.includes('Insufficient credits') ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
