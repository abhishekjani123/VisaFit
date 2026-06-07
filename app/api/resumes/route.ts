import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db/client'
import { resolveAuthUser, getUserResumes, upsertResume, deleteResume, getSlotNames, setSlotName } from '@/lib/auth'
import { computeEmbedding } from '@/lib/match'
import { buildResumeProfile, type ResumeProfile } from '@/lib/resume-profile'

function profileFromStored(stored: string | null, content: string): ResumeProfile {
  if (stored) {
    try {
      return JSON.parse(stored) as ResumeProfile
    } catch {
      // fall through
    }
  }
  return buildResumeProfile(content)
}

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ resumes: [], hasResume: false, slotNames: {} })

    const [resumes, slotNames] = await Promise.all([
      getUserResumes(user.id),
      getSlotNames(user.id),
    ])

    return NextResponse.json({
      resumes: resumes.map((r) => {
        const profile = profileFromStored(r.profile_json, r.content)
        return { ...r, name: slotNames[r.slot] ?? r.name, profile }
      }),
      slotNames,
      hasResume: resumes.length > 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch resumes'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { slot, name, content, filename, profile: clientProfile } = await req.json()
    if (!slot || !content) {
      return NextResponse.json({ error: 'slot and content required' }, { status: 400 })
    }

    const profileData: ResumeProfile =
      clientProfile && typeof clientProfile === 'object'
        ? (clientProfile as ResumeProfile)
        : buildResumeProfile(content)
    const profileJson = JSON.stringify(profileData)

    let embedding: string | undefined
    if (process.env.OPENAI_API_KEY) {
      try {
        embedding = await computeEmbedding(content)
      } catch {
        // continue without embedding
      }
    }

    const slotNames = await getSlotNames(user.id)
    const resumeName = (name ?? slotNames[slot] ?? `Resume ${slot}`).trim()

    const id = await upsertResume(
      user.id,
      slot,
      resumeName,
      content,
      filename,
      embedding,
      profileJson,
    )
    const updatedNames = await getSlotNames(user.id)
    return NextResponse.json({ id, profile: profileData, slotNames: updatedNames, name: resumeName })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save resume'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { slot, name } = await req.json()
    if (!slot || !name?.trim()) {
      return NextResponse.json({ error: 'slot and name required' }, { status: 400 })
    }

    await setSlotName(user.id, slot, name.trim())
    const slotNames = await getSlotNames(user.id)
    return NextResponse.json({ ok: true, slotNames, name: slotNames[slot] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rename slot'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await initDb()
    const user = await resolveAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const slot = parseInt(searchParams.get('slot') ?? '0', 10)
    if (!slot) return NextResponse.json({ error: 'slot required' }, { status: 400 })

    await deleteResume(user.id, slot)
    const slotNames = await getSlotNames(user.id)
    return NextResponse.json({ ok: true, slotNames })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete resume'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
