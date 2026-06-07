import { NextRequest, NextResponse } from 'next/server'
import { initDb } from '@/lib/db/client'
import {
  createUser,
  authenticateUser,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
  userHasResume,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { action, email, password, name } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    if (action === 'register') {
      const user = await createUser(email, password, name)
      const token = await createSession(user.id)
      await setSessionCookie(token)
      return NextResponse.json({ user, token, hasResume: false, isNewUser: true })
    }

    const user = await authenticateUser(email, password)
    const token = await createSession(user.id)
    await setSessionCookie(token)
    const hasResume = await userHasResume(user.id)
    return NextResponse.json({ user, token, hasResume, isNewUser: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auth failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET() {
  try {
    await initDb()
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ user: null, hasResume: false })
    const hasResume = await userHasResume(user.id)
    return NextResponse.json({ user, hasResume })
  } catch {
    return NextResponse.json({ user: null, hasResume: false })
  }
}

export async function DELETE() {
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
