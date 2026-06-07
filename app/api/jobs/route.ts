import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db/client'
import { resolveAuthUser } from '@/lib/auth'
import { getTrackerJobs, getTrackerStats, updateJobStatus, getJobById, getLatestIngestionId, clearUserTracker } from '@/lib/job-analyzer'

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const ingestionId = searchParams.get('ingestionId')
    const jobId = searchParams.get('id')
    const stats = searchParams.get('stats')
    const showAll = searchParams.get('all') === 'true'

    let effectiveIngestionId = ingestionId ?? undefined
    if (!effectiveIngestionId && !showAll) {
      effectiveIngestionId = (await getLatestIngestionId(user.id)) ?? undefined
    }

    if (stats === 'true') {
      const data = await getTrackerStats(user.id, effectiveIngestionId)
      return NextResponse.json(data)
    }

    if (jobId) {
      const job = await getJobById(user.id, jobId)
      if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ job })
    }

    const jobs = await getTrackerJobs(user.id, effectiveIngestionId)
    return NextResponse.json({ jobs, ingestionId: effectiveIngestionId ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch jobs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { jobId, status } = await req.json()
    if (!jobId || !status) return NextResponse.json({ error: 'jobId and status required' }, { status: 400 })

    await updateJobStatus(user.id, jobId, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update job'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    await clearUserTracker(user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear jobs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
