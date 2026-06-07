import { createClient, type Client } from '@libsql/client'
import fs from 'fs'
import path from 'path'

let client: Client | null = null

const SCHEMA_PATH = path.join(process.cwd(), 'lib/db/schema.sql')

function getDbUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL
  }
  const localPath = path.join(process.cwd(), 'data', 'visafit.db')
  return `file:${localPath}`
}

function getAuthToken(): string | undefined {
  return process.env.TURSO_AUTH_TOKEN
}

export function getDb(): Client {
  if (!client) {
    const url = getDbUrl()
    client = createClient({
      url,
      authToken: getAuthToken(),
    })
  }
  return client
}

export async function initDb(): Promise<void> {
  const db = getDb()
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await db.execute(statement)
  }

  await migrateSchema(db)
}

async function migrateSchema(db: Client): Promise<void> {
  let cols = await db.execute('PRAGMA table_info(resumes)')
  let colNames = cols.rows.map((r) => r.name as string)

  if (!colNames.includes('slot') && colNames.includes('label')) {
    await db.execute(`
      CREATE TABLE resumes_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slot INTEGER NOT NULL CHECK(slot >= 1 AND slot <= 5),
        name TEXT NOT NULL DEFAULT 'Resume',
        content TEXT NOT NULL,
        filename TEXT,
        embedding TEXT,
        profile_json TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, slot)
      )
    `)

    const oldRows = await db.execute('SELECT id, user_id, label, content, filename, updated_at FROM resumes ORDER BY updated_at')
    const slotByUser = new Map<string, number>()
    for (const row of oldRows.rows) {
      const userId = row.user_id as string
      const nextSlot = (slotByUser.get(userId) ?? 0) + 1
      if (nextSlot > 5) continue
      slotByUser.set(userId, nextSlot)
      await db.execute({
        sql: `INSERT INTO resumes_new (id, user_id, slot, name, content, filename, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row.id as string,
          userId,
          nextSlot,
          (row.label as string) || 'Resume',
          row.content as string,
          (row.filename as string | null) ?? null,
          row.updated_at as string,
        ],
      })
    }

    await db.execute('DROP TABLE resumes')
    await db.execute('ALTER TABLE resumes_new RENAME TO resumes')
    await db.execute('CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id)')

    cols = await db.execute('PRAGMA table_info(resumes)')
    colNames = cols.rows.map((r) => r.name as string)
  }

  if (colNames.includes('slot') && !colNames.includes('profile_json')) {
    await db.execute('ALTER TABLE resumes ADD COLUMN profile_json TEXT')
  }

  const userCols = await db.execute('PRAGMA table_info(users)')
  const userColNames = userCols.rows.map((r) => r.name as string)
  if (!userColNames.includes('slot_names_json')) {
    await db.execute('ALTER TABLE users ADD COLUMN slot_names_json TEXT')
  }

  const jobCols = await db.execute('PRAGMA table_info(jobs)')
  const jobColNames = jobCols.rows.map((r) => r.name as string)
  if (!jobColNames.includes('visa_summary')) {
    await db.execute('ALTER TABLE jobs ADD COLUMN visa_summary TEXT')
  }
  if (!jobColNames.includes('visa_confidence')) {
    await db.execute('ALTER TABLE jobs ADD COLUMN visa_confidence INTEGER')
  }
}

export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = [],
): Promise<T | null> {
  const db = getDb()
  const result = await db.execute({ sql, args })
  if (result.rows.length === 0) return null
  return result.rows[0] as unknown as T
}

export async function queryAll<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = [],
): Promise<T[]> {
  const db = getDb()
  const result = await db.execute({ sql, args })
  return result.rows as unknown as T[]
}

export async function execute(
  sql: string,
  args: (string | number | null)[] = [],
): Promise<void> {
  const db = getDb()
  await db.execute({ sql, args })
}
