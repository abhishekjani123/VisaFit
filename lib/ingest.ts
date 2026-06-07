import { randomBytes } from 'crypto'
import { execute, queryOne } from './db/client'
import { parseSearchUrl, fetchJobStubs } from './linkedin'
import { getUserResumesForMatch, processJobStub } from './job-analyzer'
import type { IngestionStatus } from './types'

const BATCH_SIZE = 5

export async function createIngestion(userId: string, url: string): Promise<string> {
  const params = parseSearchUrl(url)
  const id = randomBytes(12).toString('hex')
  await execute(
    'INSERT INTO ingestions (id, user_id, url, params_json, status) VALUES (?, ?, ?, ?, ?)',
    [id, userId, url, JSON.stringify(params), 'pending'],
  )
  return id
}

export async function getIngestion(userId: string, ingestionId: string) {
  return queryOne<{
    id: string
    url: string
    params_json: string
    total: number
    analyzed: number
    status: string
    error: string | null
    created_at: string
  }>('SELECT * FROM ingestions WHERE id = ? AND user_id = ?', [ingestionId, userId])
}

async function setIngestionStatus(
  id: string,
  status: IngestionStatus,
  fields?: { total?: number; analyzed?: number; error?: string },
): Promise<void> {
  const sets = ["status = ?", "updated_at = datetime('now')"]
  const args: (string | number | null)[] = [status]

  if (fields?.total !== undefined) {
    sets.push('total = ?')
    args.push(fields.total)
  }
  if (fields?.analyzed !== undefined) {
    sets.push('analyzed = ?')
    args.push(fields.analyzed)
  }
  if (fields?.error !== undefined) {
    sets.push('error = ?')
    args.push(fields.error)
  }

  args.push(id)
  await execute(`UPDATE ingestions SET ${sets.join(', ')} WHERE id = ?`, args)
}

export async function runIngestion(userId: string, ingestionId: string): Promise<void> {
  const ingestion = await getIngestion(userId, ingestionId)
  if (!ingestion) throw new Error('Ingestion not found')

  try {
    await setIngestionStatus(ingestionId, 'fetching')
    const params = parseSearchUrl(ingestion.url)
    const stubs = await fetchJobStubs(params, 10)
    await setIngestionStatus(ingestionId, 'analyzing', { total: stubs.length, analyzed: 0 })

    const resumes = await getUserResumesForMatch(userId)
    if (resumes.length === 0) {
      throw new Error('Add at least one resume before importing jobs')
    }

    let analyzed = 0
    for (let i = 0; i < stubs.length; i += BATCH_SIZE) {
      const batch = stubs.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async (stub) => {
          try {
            await processJobStub(userId, ingestionId, stub, resumes)
          } catch {
            // skip failed jobs
          }
        }),
      )
      analyzed = Math.min(i + batch.length, stubs.length)
      await setIngestionStatus(ingestionId, 'analyzing', { analyzed })
    }

    await setIngestionStatus(ingestionId, 'done', { analyzed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingestion failed'
    await setIngestionStatus(ingestionId, 'error', { error: message })
    throw err
  }
}
