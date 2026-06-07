import { randomBytes } from 'crypto'
import type { JobEvidence, JobMeta, SignalColor } from './types'
import { regexPrepass } from './regex-prepass'
import { matchResumesToJob, pickBestMatch } from './match'
import {
  evaluateEmployer,
  evaluateJobSignals,
  computeGhostStaffing,
  mergeVerdict,
} from './visa-evaluator'
import { execute, queryAll, queryOne } from './db/client'
import type { JobStub } from './linkedin'
import { fetchJobDetail, EMPTY_JOB_META } from './linkedin'

function deriveOverallVerdict(
  visa: SignalColor,
  ghost: SignalColor,
  fitScore: number,
): SignalColor {
  if (ghost === 'red' || visa === 'red') return 'red'
  if (ghost === 'yellow' || visa === 'yellow' || fitScore < 40) return 'yellow'
  return 'green'
}

export async function analyzeJobText(
  jd: string,
  company: string,
  resumes: Array<{ id: string; slot: number; name: string; content: string; embedding: string | null }>,
  meta: JobMeta = EMPTY_JOB_META,
): Promise<JobEvidence> {
  const prepass = regexPrepass(jd)

  const [employer, signals] = await Promise.all([
    evaluateEmployer(company),
    evaluateJobSignals(jd, company, prepass, meta),
  ])

  const ghostStaffing = computeGhostStaffing(
    prepass,
    meta,
    signals.ghostLlm,
    signals.staffingLlm,
    signals.llmFallback,
  )
  const verdict = mergeVerdict(employer, signals.jdVisa)

  const resumeMatches = await matchResumesToJob(jd, resumes)
  const best = pickBestMatch(resumeMatches)
  const fitScore = best?.score ?? 0

  const overallVerdict = deriveOverallVerdict(verdict.summarySignal, ghostStaffing.ghostSignal, fitScore)

  return {
    prepass,
    employer,
    jdVisa: signals.jdVisa,
    verdict,
    ghostStaffing,
    meta,
    resumeMatches,
    bestResume: best,
    overallVerdict,
  }
}

export async function getUserResumesForMatch(userId: string) {
  return queryAll<{ id: string; slot: number; name: string; content: string; embedding: string | null }>(
    'SELECT id, slot, name, content, embedding FROM resumes WHERE user_id = ? ORDER BY slot',
    [userId],
  )
}

export async function saveJobFromAnalysis(
  userId: string,
  ingestionId: string,
  stub: JobStub,
  jdText: string,
  evidence: JobEvidence,
): Promise<string> {
  const id = randomBytes(12).toString('hex')

  await execute(
    `INSERT OR REPLACE INTO jobs
      (id, user_id, ingestion_id, linkedin_job_id, title, company, location, posted_date, url, jd_text,
       visa_signal, visa_summary, visa_confidence, ghost_risk, ghost_score, staffing_score,
       best_resume_id, fit_score, evidence_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'interested')`,
    [
      id,
      userId,
      ingestionId,
      stub.linkedinJobId,
      stub.title,
      stub.company,
      stub.location,
      stub.postedDate,
      stub.url,
      jdText,
      evidence.verdict.summarySignal,
      evidence.verdict.summaryLabel,
      evidence.verdict.confidence,
      evidence.ghostStaffing.ghostSignal,
      evidence.ghostStaffing.ghostScore,
      evidence.ghostStaffing.staffingScore,
      evidence.bestResume?.resumeId ?? null,
      evidence.bestResume?.score ?? 0,
      JSON.stringify(evidence),
    ],
  )

  return id
}

export async function processJobStub(
  userId: string,
  ingestionId: string,
  stub: JobStub,
  resumes: Array<{ id: string; slot: number; name: string; content: string; embedding: string | null }>,
): Promise<void> {
  const detail = await fetchJobDetail(stub.linkedinJobId)
  if (detail.text.length < 50) return

  const evidence = await analyzeJobText(detail.text, stub.company || stub.title, resumes, detail.meta)
  await saveJobFromAnalysis(userId, ingestionId, stub, detail.text, evidence)
}

export async function reanalyzeJobEvidence(
  jdText: string,
  company: string,
  userId: string,
  meta: JobMeta = EMPTY_JOB_META,
): Promise<JobEvidence | null> {
  const resumes = await getUserResumesForMatch(userId)
  if (resumes.length === 0 || jdText.length < 50) return null
  return analyzeJobText(jdText, company, resumes, meta)
}

export function needsEvidenceRefresh(evidenceJson: string | null): boolean {
  if (!evidenceJson) return true
  try {
    const parsed = JSON.parse(evidenceJson) as JobEvidence
    return !parsed.verdict || !parsed.employer || !parsed.jdVisa || !parsed.ghostStaffing
  } catch {
    return true
  }
}

export async function getTrackerJobs(userId: string, ingestionId?: string) {
  const sql = ingestionId
    ? `SELECT j.*, r.name as best_resume_name FROM jobs j
       LEFT JOIN resumes r ON r.id = j.best_resume_id
       WHERE j.user_id = ? AND j.ingestion_id = ? ORDER BY j.fit_score DESC`
    : `SELECT j.*, r.name as best_resume_name FROM jobs j
       LEFT JOIN resumes r ON r.id = j.best_resume_id
       WHERE j.user_id = ? ORDER BY j.created_at DESC`

  const args = ingestionId ? [userId, ingestionId] : [userId]
  return queryAll<Record<string, unknown>>(sql, args)
}

export async function updateJobStatus(
  userId: string,
  jobId: string,
  status: string,
): Promise<void> {
  const appliedAt = status === 'applied' ? new Date().toISOString() : null
  await execute(
    'UPDATE jobs SET status = ?, applied_at = COALESCE(?, applied_at) WHERE id = ? AND user_id = ?',
    [status, appliedAt, jobId, userId],
  )
}

export async function getJobById(userId: string, jobId: string) {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT j.*, r.name as best_resume_name, r.content as best_resume_content
     FROM jobs j LEFT JOIN resumes r ON r.id = j.best_resume_id
     WHERE j.id = ? AND j.user_id = ?`,
    [jobId, userId],
  )
  if (!row) return null

  const evidenceJson = row.evidence_json as string | null
  if (needsEvidenceRefresh(evidenceJson)) {
    const jdText = String(row.jd_text ?? '')
    const company = String(row.company ?? row.title ?? '')
    let meta = EMPTY_JOB_META
    if (evidenceJson) {
      try {
        meta = (JSON.parse(evidenceJson) as JobEvidence).meta ?? EMPTY_JOB_META
      } catch {
        // keep default
      }
    }
    const evidence = await reanalyzeJobEvidence(jdText, company, userId, meta)
    if (evidence) {
      row.evidence_json = JSON.stringify(evidence)
      row.visa_signal = evidence.verdict.summarySignal
      row.visa_summary = evidence.verdict.summaryLabel
      row.visa_confidence = evidence.verdict.confidence
      row.ghost_risk = evidence.ghostStaffing.ghostSignal
      row.ghost_score = evidence.ghostStaffing.ghostScore
      row.staffing_score = evidence.ghostStaffing.staffingScore
      await execute(
        `UPDATE jobs SET evidence_json = ?, visa_signal = ?, visa_summary = ?, visa_confidence = ?,
         ghost_risk = ?, ghost_score = ?, staffing_score = ? WHERE id = ?`,
        [
          JSON.stringify(evidence),
          evidence.verdict.summarySignal,
          evidence.verdict.summaryLabel,
          evidence.verdict.confidence,
          evidence.ghostStaffing.ghostSignal,
          evidence.ghostStaffing.ghostScore,
          evidence.ghostStaffing.staffingScore,
          jobId,
        ],
      )
    }
  }

  return row
}

export async function getTrackerStats(userId: string, ingestionId?: string) {
  const sql = ingestionId
    ? 'SELECT status, applied_at FROM jobs WHERE user_id = ? AND ingestion_id = ?'
    : 'SELECT status, applied_at FROM jobs WHERE user_id = ?'
  const args = ingestionId ? [userId, ingestionId] : [userId]
  const rows = await queryAll<{ status: string; applied_at: string | null }>(sql, args)
  const byStatus: Record<string, number> = {}
  const appliedByDay: Record<string, number> = {}
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    if (row.applied_at) {
      const day = row.applied_at.slice(0, 10)
      appliedByDay[day] = (appliedByDay[day] ?? 0) + 1
    }
  }
  return { total: rows.length, byStatus, appliedByDay }
}

export async function getLatestIngestionId(userId: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    'SELECT id FROM ingestions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId],
  )
  return row?.id ?? null
}

export async function clearUserTracker(userId: string): Promise<void> {
  await execute('DELETE FROM jobs WHERE user_id = ?', [userId])
  await execute('DELETE FROM ingestions WHERE user_id = ?', [userId])
}
