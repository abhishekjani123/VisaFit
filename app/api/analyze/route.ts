import { NextRequest, NextResponse } from 'next/server'
import { runVerdict } from '@/lib/verdict'
import type { AnalyzeRequest } from '@/lib/types'

export async function POST(req: NextRequest) {
    try {
        const body: AnalyzeRequest = await req.json()

        if (!body.jd || typeof body.jd !== 'string' || !body.resumeA || typeof body.resumeA !== 'string') {
            return NextResponse.json(
                { error: 'jd and resumeA are required' },
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
        }

        const result = await runVerdict({ jd: body.jd, resumeA: body.resumeA, resumeB: body.resumeB ?? '' })

        return NextResponse.json(result, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        return NextResponse.json(
            { error: message },
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        )
    }
}
