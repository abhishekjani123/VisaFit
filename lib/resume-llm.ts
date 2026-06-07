import type {
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  ResumeLink,
  ResumeProfile,
  SkillGroup,
} from './resume-profile'
import {
  buildExperienceBreakdown,
  buildMetrics,
  classifyRoleType,
  extractLinks,
  formatExperienceLabel,
  monthsBetween,
  normalizeResumeText,
  sumEmploymentMonths,
} from './resume-profile'

const MAX_RESUME_CHARS = 14_000

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export interface ResumeLLMLink {
  url: string
  label?: string
  type?: 'linkedin' | 'github' | 'portfolio' | 'email' | 'other'
}

export interface ResumeLLMExperience {
  company: string
  title: string
  startISO: string
  endISO: string
  employmentType?: 'fulltime' | 'intern' | 'contract'
  highlights?: string[]
}

export interface ResumeLLMEducation {
  school: string
  degree: string
  startISO?: string
  endISO?: string
}

export interface ResumeLLMProject {
  name: string
  link?: string | null
  highlights?: string[]
}

export interface ResumeLLMOutput {
  name?: string | null
  location?: string | null
  email?: string | null
  phone?: string | null
  links?: ResumeLLMLink[]
  skillGroups?: SkillGroup[]
  experiences?: ResumeLLMExperience[]
  education?: ResumeLLMEducation[]
  projects?: ResumeLLMProject[]
}

function buildResumePrompt(text: string): string {
  return `You are a resume parser. Extract structured data from the resume text below.

RULES:
- Return ONLY valid JSON matching the schema below.
- experiences = paid employment only (jobs, internships, co-ops). EXCLUDE: education degrees, honors, certifications, volunteer-only, competitions, summer schools.
- For each experience use startISO/endISO as "YYYY-MM" (e.g. "2023-08"). Use endISO "present" for current roles.
- employmentType: "intern" for internships/co-ops/research intern; "contract" for contract/freelance; "fulltime" otherwise.
- highlights = bullet points for that role only (max 5 each).
- skillGroups: categorize skills if the resume has categories; otherwise one group "Skills" with all skills.
- links: include LinkedIn, GitHub, portfolio, email URLs found in the resume.
- Do NOT invent employers, dates, or skills not in the text.

JSON schema:
{
  "name": "string",
  "location": "City, ST or null",
  "email": "string or null",
  "phone": "string or null",
  "links": [{ "url": "https://...", "label": "LinkedIn", "type": "linkedin|github|portfolio|email|other" }],
  "skillGroups": [{ "category": "Programming Languages", "skills": ["Python", "Java"] }],
  "experiences": [{
    "company": "Company Name",
    "title": "Job Title",
    "startISO": "YYYY-MM",
    "endISO": "YYYY-MM or present",
    "employmentType": "fulltime|intern|contract",
    "highlights": ["bullet text"]
  }],
  "education": [{
    "school": "University Name",
    "degree": "Degree and major",
    "startISO": "YYYY-MM",
    "endISO": "YYYY-MM"
  }],
  "projects": [{
    "name": "Project name",
    "link": "https://github.com/... or null",
    "highlights": ["bullet text"]
  }]
}

RESUME TEXT:
${text}`
}

function parseISOToDate(iso: string): Date | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})$/)
  if (!m) {
    const yearOnly = iso.trim().match(/^(\d{4})$/)
    if (yearOnly) return new Date(parseInt(yearOnly[1], 10), 0, 1)
    return null
  }
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  if (month < 0 || month > 11) return null
  return new Date(year, month, 1)
}

function formatISOToLabel(iso: string): string {
  const d = parseISOToDate(iso)
  if (!d) return iso
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
}

function formatPeriod(startISO: string, endISO: string): string {
  const start = formatISOToLabel(startISO)
  const end = /present|current|now/i.test(endISO) ? 'Present' : formatISOToLabel(endISO)
  return `${start} - ${end}`
}

function experienceMonths(startISO: string, endISO: string): number {
  const start = parseISOToDate(startISO)
  if (!start) return 0
  const end = /present|current|now/i.test(endISO) ? new Date() : parseISOToDate(endISO)
  if (!end || end < start) return 0
  return monthsBetween(start, end)
}

function mergeLinks(rawText: string, llmLinks: ResumeLLMLink[] = []): ResumeLink[] {
  const fromText = extractLinks(rawText)
  const seen = new Set(fromText.map((l) => l.url.toLowerCase()))
  const merged = [...fromText]

  for (const llm of llmLinks) {
    if (!llm.url?.trim()) continue
    const hint = `${llm.url} ${llm.label ?? ''} ${llm.type ?? ''}`.toLowerCase()
    const type = llm.type ?? (
      hint.includes('linkedin.com') ? 'linkedin'
        : hint.includes('github.com') ? 'github'
          : llm.url.startsWith('mailto:') || llm.url.includes('@') ? 'email'
            : 'portfolio'
    )
    const url = type === 'email' && !llm.url.startsWith('mailto:')
      ? `mailto:${llm.url.replace(/^mailto:/, '')}`
      : llm.url.startsWith('http') ? llm.url : `https://${llm.url}`

    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    merged.push({
      url,
      type: type as ResumeLink['type'],
      label: llm.label ?? (
        type === 'linkedin' ? 'LinkedIn'
          : type === 'github' ? 'GitHub'
            : type === 'email' ? llm.url.replace(/^mailto:/, '')
              : 'Portfolio'
      ),
    })
  }

  return merged
}

function mapExperiences(raw: ResumeLLMExperience[] = []): ExperienceEntry[] {
  return raw
    .filter((e) => e.company?.trim() || e.title?.trim())
    .map((e) => {
      const company = (e.company ?? '').trim()
      const title = (e.title ?? '').trim()
      const period = formatPeriod(e.startISO ?? '', e.endISO ?? 'present')
      const months = experienceMonths(e.startISO ?? '', e.endISO ?? 'present')
      const type = e.employmentType ?? classifyRoleType(title, company)

      return {
        company,
        title,
        period,
        months,
        type,
        highlights: (e.highlights ?? []).filter((h) => h.length > 5).slice(0, 5),
      }
    })
    .slice(0, 10)
}

function mapEducation(raw: ResumeLLMEducation[] = []): EducationEntry[] {
  return raw
    .filter((e) => e.school?.trim() || e.degree?.trim())
    .map((e) => {
      const period =
        e.startISO && e.endISO
          ? formatPeriod(e.startISO, e.endISO)
          : e.endISO
            ? formatISOToLabel(e.endISO)
            : ''
      return {
        school: (e.school ?? '').trim(),
        degree: (e.degree ?? '').trim(),
        year: [e.startISO, e.endISO].filter(Boolean).map((d) => d!.slice(0, 4)).join(' – '),
        period,
      }
    })
    .slice(0, 6)
}

function mapProjects(raw: ResumeLLMProject[] = []): ProjectEntry[] {
  return raw
    .filter((p) => p.name?.trim())
    .map((p) => ({
      name: p.name.trim(),
      link: p.link?.trim() || null,
      highlights: (p.highlights ?? []).filter((h) => h.length > 5).slice(0, 4),
    }))
    .slice(0, 8)
}

function flattenSkills(groups: SkillGroup[]): string[] {
  return [...new Set(groups.flatMap((g) => g.skills))].slice(0, 40)
}

export function normalizeLLMProfile(rawText: string, llm: ResumeLLMOutput): ResumeProfile {
  const text = normalizeResumeText(rawText)
  const experiences = mapExperiences(llm.experiences)
  const education = mapEducation(llm.education)
  const projects = mapProjects(llm.projects)
  const skillGroups = (llm.skillGroups ?? []).filter((g) => g.category && g.skills?.length).slice(0, 10)
  const skills = flattenSkills(skillGroups)
  const links = mergeLinks(text, llm.links)
  const breakdown = buildExperienceBreakdown(experiences)
  const totalMonths = sumEmploymentMonths(experiences)
  const years = totalMonths > 0 ? Math.round((totalMonths / 12) * 10) / 10 : null

  const email =
    llm.email?.trim() ??
    links.find((l) => l.type === 'email')?.label ??
    text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ??
    null

  const highlights = experiences.flatMap((e) => e.highlights).filter((h) => h.length > 15).slice(0, 6)

  if (experiences.length === 0 && education.length === 0) {
    throw new Error('LLM profile missing experiences and education')
  }

  return {
    name: llm.name?.trim() || null,
    location: llm.location?.trim() || null,
    email,
    phone: (llm.phone?.trim() || text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0]) ?? null,
    links,
    skills,
    skillGroups,
    totalYearsExperience: years,
    totalMonthsExperience: totalMonths > 0 ? totalMonths : null,
    experienceLabel: breakdown?.totalLabel ?? (totalMonths > 0 ? formatExperienceLabel(totalMonths) : null),
    experienceBreakdown: breakdown,
    experiences,
    education,
    projects,
    highlights,
    metrics: buildMetrics(breakdown, experiences, skills.length),
  }
}

export async function parseResumeWithLLM(rawText: string): Promise<ResumeProfile> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const text = normalizeResumeText(rawText).slice(0, MAX_RESUME_CHARS)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: buildResumePrompt(text) }],
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI resume parse failed (${response.status})`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty LLM response')

  const parsed = JSON.parse(content) as ResumeLLMOutput
  return normalizeLLMProfile(rawText, parsed)
}

export async function parseResume(
  rawText: string,
): Promise<{ profile: ResumeProfile; parsedBy: 'llm' | 'regex' }> {
  const { buildResumeProfile } = await import('./resume-profile')

  if (process.env.OPENAI_API_KEY) {
    try {
      const profile = await parseResumeWithLLM(rawText)
      return { profile, parsedBy: 'llm' }
    } catch {
      // fall through to regex
    }
  }

  return { profile: buildResumeProfile(rawText), parsedBy: 'regex' }
}
