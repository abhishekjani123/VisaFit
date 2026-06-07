import type { JobMeta, NoteCategory, PrepassResult } from './types'

export function buildJobSignalsPrompt(
  jd: string,
  company: string,
  prepass: PrepassResult,
  meta: JobMeta,
): string {
  const sponsorshipHits = prepass.hits.filter(
    (h) => h.category === 'sponsorship_yes' || h.category === 'sponsorship_no',
  )
  const ghostStaffingHits = prepass.hits.filter(
    (h) => h.category === 'ghost' || h.category === 'staffing' || h.category === 'consultancy',
  )

  return `You are a job posting analyst for international students evaluating H-1B sponsorship, ghost jobs, and staffing/body-shop postings. Return ONLY valid JSON.

Output schema:
{
  "visa": {
    "classification": "explicit_yes" | "likely_yes" | "silent" | "ambiguous" | "likely_no" | "explicit_no",
    "jdSignal": "green" | "yellow" | "red",
    "jdScore": number (0-100),
    "workAuthRequired": string[],
    "sponsorshipMentioned": boolean,
    "evidenceQuotes": string[],
    "reasoning": string,
    "confidence": number
  },
  "ghost": {
    "isGhost": boolean,
    "ghostScore": number (0-100),
    "signal": "green" | "yellow" | "red",
    "evidenceQuotes": string[],
    "reasoning": string,
    "confidence": number
  },
  "staffing": {
    "isStaffing": boolean,
    "type": "direct" | "staffing" | "consultancy" | "body_shop",
    "staffingScore": number (0-100),
    "signal": "green" | "yellow" | "red",
    "evidenceQuotes": string[],
    "reasoning": string,
    "confidence": number
  }
}

Rules:
- Quote exact JD sentences in evidenceQuotes (up to 3 per section).
- Ghost: pipeline roles, talent pools, no immediate opening, evergreen reqs, vague multi-location roles. High applicant counts and reposts increase ghost likelihood.
- Staffing/body_shop: C2C, W2-only, "we market your profile", training/placement, submit resume to clients, vendor layers, benching. body_shop = placement/marketing language; consultancy = IT consulting firm language; staffing = generic agency/vendor.
- Visa: same classification rules as standard H-1B JD analysis.

Regex hints (non-authoritative):
- ghostScore=${prepass.ghostScore}, staffingScore=${prepass.staffingScore}, consultancyScore=${prepass.consultancyScore}
- mentionsSponsorship=${prepass.mentionsSponsorship}, deniesSponsorship=${prepass.deniesSponsorship}
- sponsorship hits: ${JSON.stringify(sponsorshipHits.map((h) => ({ label: h.label, text: h.matchedText })))}
- ghost/staffing hits: ${JSON.stringify(ghostStaffingHits.slice(0, 12).map((h) => ({ label: h.label, category: h.category, text: h.matchedText })))}

LinkedIn metadata hints:
- applicants: ${meta.applicantText ?? 'unknown'} (count: ${meta.applicantCount ?? 'unknown'})
- posted: ${meta.postedAgo ?? 'unknown'}, reposted: ${meta.reposted}, daysAgo: ${meta.postedDaysAgo ?? 'unknown'}
- activelyRecruiting: ${meta.activelyRecruiting}
- employmentType: ${meta.employmentType ?? 'unknown'}, seniority: ${meta.seniority ?? 'unknown'}
- jobFunctions: ${JSON.stringify(meta.jobFunctions)}

Company: ${company}
--- JOB DESCRIPTION ---
${jd.slice(0, 8000)}`
}

/** @deprecated Use buildJobSignalsPrompt */
export function buildJdVisaPrompt(jd: string, company: string, prepass: PrepassResult): string {
  return buildJobSignalsPrompt(jd, company, prepass, {
    applicantCount: null,
    applicantText: null,
    postedAgo: null,
    reposted: false,
    postedDaysAgo: null,
    activelyRecruiting: false,
    employmentType: null,
    seniority: null,
    jobFunctions: [],
    industries: [],
  })
}

export function buildAnalysisPrompt(
  jd: string,
  resumeA: string,
  resumeB: string,
  prepass: PrepassResult,
): string {
  return `You are a job application analyst specializing in H-1B visa sponsorship and ghost job detection. Return ONLY valid JSON.

Output schema:
{
  "company": string,
  "ghostRisk": "green" | "yellow" | "red",
  "ghostFlags": string[],
  "resumeA": { "score": number, "pros": string[], "gaps": string[] },
  "resumeB": { "score": number, "pros": string[], "gaps": string[] },
  "recommended": "A" | "B" | "neither",
  "reason": string
}

Pre-detected scores: ghost=${prepass.ghostScore}, staffing=${prepass.staffingScore}, sponsorship=${prepass.sponsorshipScore}
Flags: ${JSON.stringify([...prepass.ghostFlags, ...prepass.staffingFlags])}

--- JOB DESCRIPTION ---
${jd}
--- RESUME A ---
${resumeA}
--- RESUME B ---
${resumeB}`
}

export function buildDeepEvidencePrompt(jd: string, resume: string, company: string): string {
  return `Analyze resume fit for this job. Return ONLY valid JSON:
{
  "matchedPoints": string[],
  "gaps": string[],
  "reasoning": string
}

Rules:
- matchedPoints: up to 5 specific resume experiences/skills that match JD requirements (cite exact resume content)
- gaps: up to 5 specific JD requirements missing from resume
- reasoning: 2-3 sentences explaining fit with evidence

Company: ${company}
--- JOB DESCRIPTION ---
${jd}
--- RESUME ---
${resume}`
}

export function buildCoverLetterPrompt(
  jd: string,
  resume: string,
  company: string,
  visaContext: string,
): string {
  return `Write a cover letter and list what you used. Return ONLY valid JSON:
{
  "letter": string,
  "usedFromResume": string[],
  "usedFromJd": string[]
}

Rules:
- letter: 3-4 paragraphs, under 350 words, plain text
- usedFromResume: up to 4 specific resume points you referenced
- usedFromJd: up to 4 specific JD requirements you addressed
- Mention H-1B only if visaContext suggests sponsorship is relevant

Company: ${company}
Visa context: ${visaContext}
--- JOB DESCRIPTION ---
${jd}
--- RESUME ---
${resume}`
}

const NOTE_PROMPTS: Record<NoteCategory, string> = {
  hiring_manager: `Write a LinkedIn connection note to the hiring manager/recruiter for this role. Tone: professional, direct, shows you read the JD. Ask about the role briefly.`,
  founder: `Write a LinkedIn connection note to a founder or executive at this company. Tone: concise, mission-aligned, shows genuine interest in the company (not just the job).`,
  peer: `Write a LinkedIn connection note to someone in a similar role at this company. Tone: collegial, ask about team culture or day-to-day work.`,
}

export function buildLinkedInNotePrompt(
  category: NoteCategory,
  jd: string,
  resume: string,
  company: string,
): string {
  return `${NOTE_PROMPTS[category]}

Return ONLY valid JSON:
{
  "note": string,
  "usedFromResume": string[],
  "usedFromJd": string[]
}

CRITICAL: note MUST be <= 278 characters including spaces. Count carefully.
- usedFromResume: up to 2 resume points referenced
- usedFromJd: up to 2 JD points referenced

Company: ${company}
--- JOB DESCRIPTION ---
${jd.slice(0, 3000)}
--- RESUME ---
${resume.slice(0, 3000)}`
}
