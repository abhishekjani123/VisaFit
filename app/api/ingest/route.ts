import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db/client'
import { resolveAuthUser } from '@/lib/auth'
import { createIngestion, getIngestion, runIngestion } from '@/lib/ingest'
import { clearUserTracker } from '@/lib/job-analyzer'

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'LinkedIn search URL required' }, { status: 400 })

    await clearUserTracker(user.id)
    const ingestionId = await createIngestion(user.id, url)

    // Run in background (don't await full completion)
    runIngestion(user.id, ingestionId).catch(() => {})

    return NextResponse.json({ ingestionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingestion failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const ingestion = await getIngestion(user.id, id)
    if (!ingestion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      id: ingestion.id,
      url: ingestion.url,
      total: ingestion.total,
      analyzed: ingestion.analyzed,
      status: ingestion.status,
      error: ingestion.error,
      createdAt: ingestion.created_at,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch ingestion'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
