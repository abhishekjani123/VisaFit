import { createHash } from 'crypto'
import type {
  EmployerVisaEvidence,
  GhostStaffingEvidence,
  GhostStaffingLLMOutput,
  JdVisaEvidence,
  JobMeta,
  JobSignalsLLMOutput,
  MatchConfidence,
  PrepassResult,
  SignalColor,
  StaffingLLMOutput,
  StaffingType,
  VisaVerdict,
} from './types'
import { lookupLCA, type LCAResult } from './lca'
import { buildJobSignalsPrompt } from './prompts'
import { scoreJobMeta } from './meta-scoring'
import {
  inferStaffingTypeFromHits,
  scoreToGhostSignal,
  scoreToStaffingSignal,
} from './regex-prepass'
import { EMPTY_JOB_META } from './linkedin'

const RECENT_FYS = ['FY2025', 'FY2024', 'FY2026']

interface CachedSignals {
  jdVisa: JdVisaEvidence
  ghostLlm: GhostStaffingLLMOutput
  staffingLlm: StaffingLLMOutput
}

const signalsCache = new Map<string, CachedSignals>()

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

function recentFilingsCount(filings: Record<string, number>): number {
  return RECENT_FYS.reduce((sum, fy) => sum + (filings[fy] ?? 0), 0)
}

function mapEmployerScore(lca: LCAResult, recentTotal: number): number {
  let score: number
  if (lca.signal === 'green') score = 80 + Math.min(recentTotal, 20)
  else if (lca.signal === 'yellow') score = 40 + Math.min(recentTotal * 5, 39)
  else score = Math.min(recentTotal * 5, 39)

  if (lca.approvalRate != null && lca.approvalRate >= 85) score += 10
  if (lca.matchType === 'fuzzy' || lca.matchType === 'none' || lca.matchType === 'fallback') score -= 15

  return clamp(score)
}

function extractDisplayName(reason: string, rawCompany: string): string {
  const quoted = reason.match(/for "([^"]+)"/)?.[1]
  return quoted ?? rawCompany
}

export async function evaluateEmployer(company: string): Promise<EmployerVisaEvidence> {
  const lca = await lookupLCA(company)
  const recentFilings = recentFilingsCount(lca.filings)
  const matchConfidence = lca.matchType as MatchConfidence

  return {
    employerSignal: lca.signal,
    employerScore: mapEmployerScore(lca, recentFilings),
    recentFilings,
    trend: lca.trend,
    approvalRate: lca.approvalRate,
    matchConfidence,
    employerSummary: lca.reason,
    filings: lca.filings,
    medianWage: lca.medianWage,
    topTitles: lca.topTitles,
    caveat: lca.caveat,
    validationLinks: lca.validationLinks,
    displayName: extractDisplayName(lca.reason, company),
  }
}

function regexFallbackVisa(prepass: PrepassResult): JdVisaEvidence {
  if (prepass.deniesSponsorship) {
    return {
      classification: 'explicit_no',
      jdSignal: 'red',
      jdScore: 5,
      workAuthRequired: [],
      sponsorshipMentioned: false,
      evidenceQuotes: prepass.hits.filter((h) => h.category === 'sponsorship_no').map((h) => h.matchedText).slice(0, 3),
      reasoning: 'Regex detected explicit no-sponsorship language.',
      confidence: 40,
      llmFallback: true,
    }
  }
  if (prepass.mentionsSponsorship) {
    return {
      classification: 'explicit_yes',
      jdSignal: 'green',
      jdScore: 75,
      workAuthRequired: [],
      sponsorshipMentioned: true,
      evidenceQuotes: prepass.hits.filter((h) => h.category === 'sponsorship_yes').map((h) => h.matchedText).slice(0, 3),
      reasoning: 'Regex detected sponsorship-friendly language (LLM unavailable).',
      confidence: 40,
      llmFallback: true,
    }
  }
  return {
    classification: 'ambiguous',
    jdSignal: 'yellow',
    jdScore: 50,
    workAuthRequired: [],
    sponsorshipMentioned: false,
    evidenceQuotes: [],
    reasoning: 'Could not analyze JD with LLM; no clear sponsorship signals.',
    confidence: 30,
    llmFallback: true,
  }
}

function regexFallbackGhost(prepass: PrepassResult, meta: JobMeta): GhostStaffingLLMOutput {
  const metaScore = scoreJobMeta(meta)
  const blended = clamp(Math.round(prepass.ghostScore * 0.6 + metaScore.ghostScore * 0.4))
  return {
    isGhost: blended >= 30,
    ghostScore: blended,
    signal: scoreToGhostSignal(blended),
    evidenceQuotes: prepass.hits.filter((h) => h.category === 'ghost').map((h) => h.matchedText).filter(Boolean).slice(0, 3),
    reasoning: 'Regex and metadata analysis (LLM unavailable).',
    confidence: 35,
  }
}

function regexFallbackStaffing(prepass: PrepassResult): StaffingLLMOutput {
  const type = inferStaffingTypeFromHits(prepass.hits)
  const score = prepass.staffingScore
  return {
    isStaffing: score >= 25 || type !== 'direct',
    type,
    staffingScore: score,
    signal: scoreToStaffingSignal(score),
    evidenceQuotes: prepass.hits
      .filter((h) => h.category === 'staffing' || h.category === 'consultancy')
      .map((h) => h.matchedText)
      .filter(Boolean)
      .slice(0, 3),
    reasoning: 'Regex analysis (LLM unavailable).',
    confidence: 35,
  }
}

async function callJobSignalsLLM(
  jd: string,
  company: string,
  prepass: PrepassResult,
  meta: JobMeta,
): Promise<JobSignalsLLMOutput> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: buildJobSignalsPrompt(jd, company, prepass, meta) }],
      max_tokens: 900,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)

  const data = await response.json()
  const parsed = JSON.parse(data.choices[0].message.content) as JobSignalsLLMOutput

  const validVisa = ['explicit_yes', 'likely_yes', 'silent', 'ambiguous', 'likely_no', 'explicit_no'] as const
  if (!validVisa.includes(parsed.visa?.classification)) {
    parsed.visa.classification = 'ambiguous'
  }

  const validStaffingTypes: StaffingType[] = ['direct', 'staffing', 'consultancy', 'body_shop']
  if (!validStaffingTypes.includes(parsed.staffing?.type)) {
    parsed.staffing.type = 'direct'
  }

  return parsed
}

export function computeGhostStaffing(
  prepass: PrepassResult,
  meta: JobMeta | null | undefined,
  ghostLlm: GhostStaffingLLMOutput,
  staffingLlm: StaffingLLMOutput,
  llmFallback = false,
): GhostStaffingEvidence {
  const metaResult = scoreJobMeta(meta)
  const regexStaffingType = inferStaffingTypeFromHits(prepass.hits)

  let staffingType: StaffingType = staffingLlm.type
  if (regexStaffingType === 'body_shop') staffingType = 'body_shop'
  else if (regexStaffingType === 'consultancy' && staffingType === 'direct') staffingType = 'consultancy'
  else if (regexStaffingType === 'staffing' && staffingType === 'direct') staffingType = 'staffing'

  const ghostScore = clamp(
    Math.round(prepass.ghostScore * 0.45 + metaResult.ghostScore * 0.3 + (ghostLlm.ghostScore ?? 0) * 0.25),
  )
  const staffingScore = clamp(
    Math.round(prepass.staffingScore * 0.5 + metaResult.staffingScore * 0.2 + (staffingLlm.staffingScore ?? 0) * 0.3),
  )

  const ghostSignal = scoreToGhostSignal(ghostScore)
  const staffingSignal = scoreToStaffingSignal(staffingScore)

  const evidenceQuotes = [
    ...new Set([
      ...(ghostLlm.evidenceQuotes ?? []),
      ...(staffingLlm.evidenceQuotes ?? []),
    ]),
  ].slice(0, 6)

  const agreeGhost =
    (ghostScore >= 60 && ghostLlm.isGhost) ||
    (ghostScore < 30 && !ghostLlm.isGhost)
  const agreeStaffing =
    (staffingScore >= 60 && staffingLlm.isStaffing) ||
    (staffingScore < 30 && !staffingLlm.isStaffing)

  let confidence = Math.round(
    ((ghostLlm.confidence ?? 50) + (staffingLlm.confidence ?? 50)) / 2,
  )
  if (agreeGhost) confidence += 10
  if (agreeStaffing) confidence += 10
  confidence = clamp(confidence)

  const reasoningParts = [ghostLlm.reasoning, staffingLlm.reasoning].filter(Boolean)
  const reasoning = reasoningParts.join(' ') || 'Combined regex, metadata, and LLM analysis.'

  return {
    ghostSignal,
    ghostScore,
    staffingSignal,
    staffingScore,
    staffingType,
    isLikelyGhost: ghostScore >= 30 || ghostLlm.isGhost,
    isLikelyStaffing: staffingScore >= 30 || staffingLlm.isStaffing || staffingType !== 'direct',
    confidence,
    evidenceQuotes,
    metaSignals: metaResult.signals,
    regexHits: prepass.hits.filter(
      (h) => h.category === 'ghost' || h.category === 'staffing' || h.category === 'consultancy',
    ),
    reasoning,
    llmFallback,
  }
}

export async function evaluateJobSignals(
  jd: string,
  company: string,
  prepass: PrepassResult,
  meta: JobMeta = EMPTY_JOB_META,
): Promise<{ jdVisa: JdVisaEvidence; ghostLlm: GhostStaffingLLMOutput; staffingLlm: StaffingLLMOutput; llmFallback: boolean }> {
  const cacheKey = createHash('sha256').update(jd).digest('hex')
  const cached = signalsCache.get(cacheKey)
  if (cached) {
    return {
      jdVisa: cached.jdVisa,
      ghostLlm: cached.ghostLlm,
      staffingLlm: cached.staffingLlm,
      llmFallback: !!cached.jdVisa.llmFallback,
    }
  }

  try {
    const llm = await callJobSignalsLLM(jd, company, prepass, meta)
    const jdVisa: JdVisaEvidence = {
      classification: llm.visa.classification,
      jdSignal: llm.visa.jdSignal,
      jdScore: clamp(llm.visa.jdScore ?? 50),
      workAuthRequired: llm.visa.workAuthRequired ?? [],
      sponsorshipMentioned: llm.visa.sponsorshipMentioned ?? false,
      evidenceQuotes: llm.visa.evidenceQuotes ?? [],
      reasoning: llm.visa.reasoning ?? '',
      confidence: clamp(llm.visa.confidence ?? 50),
    }
    const ghostLlm: GhostStaffingLLMOutput = {
      isGhost: llm.ghost.isGhost ?? false,
      ghostScore: clamp(llm.ghost.ghostScore ?? 0),
      signal: llm.ghost.signal ?? 'yellow',
      evidenceQuotes: llm.ghost.evidenceQuotes ?? [],
      reasoning: llm.ghost.reasoning ?? '',
      confidence: clamp(llm.ghost.confidence ?? 50),
    }
    const staffingLlm: StaffingLLMOutput = {
      isStaffing: llm.staffing.isStaffing ?? false,
      type: llm.staffing.type ?? 'direct',
      staffingScore: clamp(llm.staffing.staffingScore ?? 0),
      signal: llm.staffing.signal ?? 'green',
      evidenceQuotes: llm.staffing.evidenceQuotes ?? [],
      reasoning: llm.staffing.reasoning ?? '',
      confidence: clamp(llm.staffing.confidence ?? 50),
    }

    signalsCache.set(cacheKey, { jdVisa, ghostLlm, staffingLlm })
    return { jdVisa, ghostLlm, staffingLlm, llmFallback: false }
  } catch {
    const jdVisa = regexFallbackVisa(prepass)
    const ghostLlm = regexFallbackGhost(prepass, meta)
    const staffingLlm = regexFallbackStaffing(prepass)
    signalsCache.set(cacheKey, { jdVisa, ghostLlm, staffingLlm })
    return { jdVisa, ghostLlm, staffingLlm, llmFallback: true }
  }
}

/** @deprecated Use evaluateJobSignals */
export async function evaluateJdVisa(
  jd: string,
  company: string,
  prepass: PrepassResult,
): Promise<JdVisaEvidence> {
  const { jdVisa } = await evaluateJobSignals(jd, company, prepass)
  return jdVisa
}

function baseConfidence(employer: EmployerVisaEvidence, jdVisa: JdVisaEvidence): number {
  const agree =
    (employer.employerSignal === 'green' && jdVisa.jdSignal === 'green') ||
    (employer.employerSignal === 'red' && jdVisa.jdSignal === 'red')
  let confidence = Math.round((employer.employerScore + jdVisa.jdScore + jdVisa.confidence) / 3)
  if (agree) confidence += 15
  if (employer.matchConfidence === 'fuzzy' || employer.matchConfidence === 'none') {
    confidence = Math.min(confidence, 60)
  }
  return clamp(confidence)
}

export function mergeVerdict(employer: EmployerVisaEvidence, jdVisa: JdVisaEvidence): VisaVerdict {
  const { classification } = jdVisa
  let summarySignal: SignalColor = 'yellow'
  let summaryLabel = 'Ask recruiter'
  let recommendedAction: VisaVerdict['recommendedAction'] = 'ask_recruiter'
  let conflictNote: string | null = null
  let headline = ''

  if (employer.matchConfidence === 'fuzzy' || employer.matchConfidence === 'none') {
    conflictNote = `Employer match is ${employer.matchConfidence} — verify company name before trusting LCA data.`
  }

  if (classification === 'explicit_no') {
    summarySignal = 'red'
    summaryLabel = 'JD says no sponsorship'
    recommendedAction = 'skip'
    headline = 'This posting explicitly states visa sponsorship is not available.'
  } else if (classification === 'explicit_yes') {
    if (employer.employerSignal === 'red') {
      summarySignal = 'yellow'
      summaryLabel = 'JD promises sponsorship — verify'
      recommendedAction = 'ask_recruiter'
      headline = 'The JD mentions sponsorship, but we found no LCA filing history for this employer.'
      conflictNote = [conflictNote, 'JD promises sponsorship but no employer LCA history found.'].filter(Boolean).join(' ')
    } else {
      summarySignal = 'green'
      summaryLabel = 'Likely sponsors'
      recommendedAction = 'apply'
      headline = 'Job description and employer history both support H-1B sponsorship.'
    }
  } else if (classification === 'likely_yes') {
    summarySignal = employer.employerSignal === 'red' ? 'yellow' : 'green'
    summaryLabel = employer.employerSignal === 'red' ? 'JD friendly — verify employer' : 'Likely sponsors'
    recommendedAction = employer.employerSignal === 'red' ? 'ask_recruiter' : 'apply'
    headline = 'JD language suggests openness to visa sponsorship.'
  } else if (classification === 'silent') {
    if (employer.employerSignal === 'green') {
      summarySignal = 'yellow'
      summaryLabel = 'Employer sponsors — JD silent'
      recommendedAction = 'ask_recruiter'
      headline = 'Employer has LCA history but this posting says nothing about sponsorship.'
      conflictNote = [conflictNote, 'Employer has LCA history but JD is silent on sponsorship.'].filter(Boolean).join(' ')
    } else if (employer.employerSignal === 'yellow') {
      summarySignal = 'yellow'
      summaryLabel = 'Ask recruiter'
      recommendedAction = 'ask_recruiter'
      headline = 'Limited employer sponsorship history and JD is silent on visa policy.'
    } else {
      summarySignal = 'red'
      summaryLabel = 'Unlikely to sponsor'
      recommendedAction = 'skip'
      headline = 'No employer LCA history and JD does not mention sponsorship.'
    }
  } else if (classification === 'likely_no') {
    summarySignal = 'red'
    summaryLabel = 'Unlikely to sponsor'
    recommendedAction = 'skip'
    headline = 'JD suggests US work authorization required without sponsorship offer.'
  } else {
    summarySignal = 'yellow'
    summaryLabel = 'Ask recruiter'
    recommendedAction = 'ask_recruiter'
    headline = 'Visa sponsorship language in this JD is unclear or mixed.'
  }

  return {
    summarySignal,
    summaryLabel,
    confidence: baseConfidence(employer, jdVisa),
    recommendedAction,
    conflictNote,
    headline,
  }
}
