import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db/client'
import { runVerdict } from '@/lib/verdict'
import {
  resolveAuthUser,
  deductCredit,
  checkRateLimit,
  saveAnalysis,
  getUserCredits,
} from '@/lib/auth'
import type { AnalyzeRequest } from '@/lib/types'

const MAX_JD_LENGTH = 50_000
const MAX_RESUME_LENGTH = 30_000

export async function POST(req: NextRequest) {
  try {
    await initDb()

    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    if (!checkRateLimit(ip, 30)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
    }

    const user = await resolveAuthUser(req)
    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to analyze. You get 10 free credits when you create an account.' },
        { status: 401 },
      )
    }
    if (!checkRateLimit(`user:${user.id}`, 15)) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
    }

    const body: AnalyzeRequest = await req.json()

    if (!body.jd || typeof body.jd !== 'string' || !body.resumeA || typeof body.resumeA !== 'string') {
      return NextResponse.json({ error: 'jd and resumeA are required' }, { status: 400 })
    }

    if (body.jd.length > MAX_JD_LENGTH) {
      return NextResponse.json({ error: `Job description too long (max ${MAX_JD_LENGTH} chars)` }, { status: 400 })
    }
    if (body.resumeA.length > MAX_RESUME_LENGTH) {
      return NextResponse.json({ error: 'Resume A too long' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
    }

    const creditsRemaining = await deductCredit(user.id)

    const result = await runVerdict({
      jd: body.jd,
      resumeA: body.resumeA,
      resumeB: body.resumeB ?? '',
    })

    await saveAnalysis(user.id, result.company, body.jd.slice(0, 120), JSON.stringify(result))

    return NextResponse.json({ ...result, creditsRemaining }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Insufficient credits') ? 402 : message.includes('Rate limit') ? 429 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ credits: null })
    const credits = await getUserCredits(user.id)
    return NextResponse.json({ credits })
  } catch {
    return NextResponse.json({ credits: null })
  }
}
