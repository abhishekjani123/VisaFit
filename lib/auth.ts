import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { queryOne, execute, queryAll } from './db/client'
import type { User } from './types'

const SESSION_COOKIE = 'visafit_session'
const SESSION_DAYS = 30
export const UNLIMITED_CREDITS = 999_999

function getUnlimitedTestEmails(): Set<string> {
  const raw = process.env.UNLIMITED_TEST_EMAILS ?? ''
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))
}

export function isUnlimitedTestUser(email: string): boolean {
  return getUnlimitedTestEmails().has(email.toLowerCase())
}

function withTestUserCredits(user: User): User {
  if (isUnlimitedTestUser(user.email)) {
    return { ...user, credits: UNLIMITED_CREDITS }
  }
  return user
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuffer = scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(hash, 'hex')
  if (hashBuffer.length !== storedBuffer.length) return false
  return timingSafeEqual(hashBuffer, storedBuffer)
}

export async function createUser(email: string, password: string, name?: string): Promise<User> {
  const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])
  if (existing) throw new Error('Email already registered')

  const id = randomBytes(16).toString('hex')
  const passwordHash = hashPassword(password)
  await execute(
    'INSERT INTO users (id, email, name, password_hash, credits) VALUES (?, ?, ?, ?, 10)',
    [id, email.toLowerCase(), name ?? null, passwordHash],
  )
  return withTestUserCredits({ id, email: email.toLowerCase(), name: name ?? null, credits: 10 })
}

export async function authenticateUser(email: string, password: string): Promise<User> {
  const row = await queryOne<{ id: string; email: string; name: string | null; password_hash: string; credits: number }>(
    'SELECT id, email, name, password_hash, credits FROM users WHERE email = ?',
    [email.toLowerCase()],
  )
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error('Invalid email or password')
  }
  return withTestUserCredits({ id: row.id, email: row.email, name: row.name, credits: row.credits })
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await execute('INSERT INTO api_tokens (token, user_id) VALUES (?, ?)', [token, userId])
  return token
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const row = await queryOne<{ id: string; email: string; name: string | null; credits: number }>(
    `SELECT u.id, u.email, u.name, u.credits FROM api_tokens t
     JOIN users u ON u.id = t.user_id WHERE t.token = ?`,
    [token],
  )
  if (!row) return null
  return withTestUserCredits(row)
}

export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return getUserFromToken(token)
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function deductCredit(userId: string): Promise<number> {
  const user = await queryOne<{ credits: number; email: string }>(
    'SELECT credits, email FROM users WHERE id = ?',
    [userId],
  )
  if (!user) throw new Error('Insufficient credits')
  if (isUnlimitedTestUser(user.email)) return UNLIMITED_CREDITS
  if (user.credits < 1) throw new Error('Insufficient credits')
  await execute('UPDATE users SET credits = credits - 1 WHERE id = ?', [userId])
  return user.credits - 1
}

export async function getUserCredits(userId: string): Promise<number> {
  const user = await queryOne<{ credits: number; email: string }>(
    'SELECT credits, email FROM users WHERE id = ?',
    [userId],
  )
  if (!user) return 0
  if (isUnlimitedTestUser(user.email)) return UNLIMITED_CREDITS
  return user.credits
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

export async function resolveAuthUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return getUserFromToken(authHeader.slice(7))
  }
  return getSessionUser()
}

export async function saveAnalysis(
  userId: string | null,
  company: string,
  jdSnippet: string,
  resultJson: string,
): Promise<void> {
  const id = randomBytes(12).toString('hex')
  await execute(
    'INSERT INTO analyses (id, user_id, company, jd_snippet, result_json) VALUES (?, ?, ?, ?, ?)',
    [id, userId, company, jdSnippet, resultJson],
  )
}

export async function getUserAnalyses(userId: string, limit = 20) {
  return queryAll<{ id: string; company: string; jd_snippet: string; result_json: string; created_at: string }>(
    'SELECT id, company, jd_snippet, result_json, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit],
  )
}

export async function getUserResumes(userId: string) {
  return queryAll<{ id: string; slot: number; name: string; content: string; filename: string | null; profile_json: string | null; updated_at: string }>(
    'SELECT id, slot, name, content, filename, profile_json, updated_at FROM resumes WHERE user_id = ? ORDER BY slot',
    [userId],
  )
}

export async function userHasResume(userId: string): Promise<boolean> {
  const row = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM resumes WHERE user_id = ?',
    [userId],
  )
  return (row?.count ?? 0) > 0
}

export const DEFAULT_SLOT_NAMES: Record<number, string> = {
  1: 'Primary',
  2: 'Backend focus',
  3: 'Full-stack',
  4: 'Data / ML',
  5: 'Custom',
}

export async function getSlotNames(userId: string): Promise<Record<number, string>> {
  const row = await queryOne<{ slot_names_json: string | null }>(
    'SELECT slot_names_json FROM users WHERE id = ?',
    [userId],
  )
  const names = { ...DEFAULT_SLOT_NAMES }
  if (row?.slot_names_json) {
    try {
      const parsed = JSON.parse(row.slot_names_json) as Record<string, string>
      for (const [k, v] of Object.entries(parsed)) {
        const slot = parseInt(k, 10)
        if (slot >= 1 && slot <= 5 && v.trim()) names[slot] = v.trim()
      }
    } catch {
      // keep defaults
    }
  }
  return names
}

export async function setSlotName(userId: string, slot: number, name: string): Promise<void> {
  if (slot < 1 || slot > 5) throw new Error('Slot must be 1-5')
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name required')

  const names = await getSlotNames(userId)
  names[slot] = trimmed
  await execute(
    'UPDATE users SET slot_names_json = ? WHERE id = ?',
    [JSON.stringify(Object.fromEntries(Object.entries(names).map(([k, v]) => [String(k), v]))), userId],
  )

  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM resumes WHERE user_id = ? AND slot = ?',
    [userId, slot],
  )
  if (existing) {
    await execute(
      "UPDATE resumes SET name = ?, updated_at = datetime('now') WHERE id = ?",
      [trimmed, existing.id],
    )
  }
}

export async function upsertResume(
  userId: string,
  slot: number,
  name: string,
  content: string,
  filename?: string,
  embedding?: string,
  profileJson?: string,
) {
  if (slot < 1 || slot > 5) throw new Error('Slot must be 1-5')

  await setSlotName(userId, slot, name)

  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM resumes WHERE user_id = ? AND slot = ?',
    [userId, slot],
  )
  if (existing) {
    await execute(
      "UPDATE resumes SET name = ?, content = ?, filename = ?, embedding = ?, profile_json = ?, updated_at = datetime('now') WHERE id = ?",
      [name, content, filename ?? null, embedding ?? null, profileJson ?? null, existing.id],
    )
    return existing.id
  }
  const id = randomBytes(12).toString('hex')
  await execute(
    'INSERT INTO resumes (id, user_id, slot, name, content, filename, embedding, profile_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, userId, slot, name, content, filename ?? null, embedding ?? null, profileJson ?? null],
  )
  return id
}

export async function deleteResume(userId: string, slot: number) {
  await execute('DELETE FROM resumes WHERE user_id = ? AND slot = ?', [userId, slot])
}
