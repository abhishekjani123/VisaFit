export interface ResumeLink {
  label: string
  url: string
  type: 'linkedin' | 'github' | 'portfolio' | 'email' | 'other'
}

export interface ExperienceEntry {
  title: string
  company: string
  period: string
  highlights: string[]
  months: number
  type: 'fulltime' | 'intern' | 'contract'
}

export interface ExperienceBreakdown {
  fullTimeMonths: number
  internMonths: number
  contractMonths: number
  fullTimeLabel: string
  internLabel: string
  contractLabel: string
  totalLabel: string
  fullTimeRoles: number
  internRoles: number
}

export interface EducationEntry {
  degree: string
  school: string
  year: string
  period: string
}

export interface ProjectEntry {
  name: string
  highlights: string[]
  link: string | null
}

export interface SkillGroup {
  category: string
  skills: string[]
}

export interface ResumeProfile {
  name: string | null
  location: string | null
  email: string | null
  phone: string | null
  links: ResumeLink[]
  skills: string[]
  skillGroups: SkillGroup[]
  totalYearsExperience: number | null
  totalMonthsExperience: number | null
  experienceLabel: string | null
  experienceBreakdown: ExperienceBreakdown | null
  experiences: ExperienceEntry[]
  education: EducationEntry[]
  projects: ProjectEntry[]
  highlights: string[]
  metrics: Array<{ label: string; value: string; icon: string }>
}

const SKILL_KEYWORDS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'Swift', 'Kotlin',
  'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB', 'GraphQL', 'REST', 'gRPC',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Git', 'Linux',
  'Machine Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Spark', 'Kafka',
  'HTML', 'CSS', 'Tailwind', 'SASS', 'Figma', 'Agile', 'Scrum', 'Jira',
  'Full Stack', 'Frontend', 'Backend', 'DevOps', 'Data Science', 'Mobile',
  'Microservices', 'System Design', 'API', 'SQL', 'NoSQL', 'Elasticsearch', 'OAuth',
  'ChromaDB', 'OpenCV', 'Scikit-Learn', 'BioBERT', 'MediaPipe', 'Prometheus', 'Grafana',
]

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

const SECTION_STOP =
  /\b(education|skills|technical skills|projects|project experience|honors|certifications|activities|publications|references)\b/i

const EXPERIENCE_HEADER =
  /\b(work experience|professional experience|experience|employment history|employment)\b/i

const DATE_ONLY_LINE =
  /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:19|20)\d{2}\s*[-–—]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:(?:19|20)\d{2}|present|current|now)\.?\s*(\(expected\))?$/i

const INLINE_ROLE_DATE =
  /^(.+?\|.+)\s+((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:19|20)\d{2}\s*[-–—]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:(?:19|20)\d{2}|present|current|now))/i

const BLOCKED_URL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'live.com', 'protonmail.com', 'mail.com', 'mail.google.com',
]

export function normalizeResumeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[–—]/g, '-')
    .replace(/\s+\|\s+/g, ' | ')
    .replace(/([A-Z][A-Z\s]{8,}[A-Z])/g, (m) => m.trim())
}

function extractSection(text: string, header: RegExp, stopPattern = SECTION_STOP): string {
  const match = text.match(header)
  if (match?.index == null) return ''

  const after = text.slice(match.index + match[0].length)
  const stopMatch = after.match(stopPattern)
  const end = stopMatch?.index != null ? stopMatch.index : Math.min(after.length, 4000)
  return after.slice(0, end).trim()
}

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;)\]>]+$/, '').trim()
}

function normalizeUrl(raw: string): string {
  const trimmed = cleanUrl(raw)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.includes('linkedin.com')) return `https://${trimmed.replace(/^www\./, '')}`
  if (trimmed.includes('github.com')) return `https://${trimmed.replace(/^www\./, '')}`
  return `https://${trimmed}`
}

function isBlockedDomain(url: string): boolean {
  const lower = url.toLowerCase()
  return BLOCKED_URL_DOMAINS.some((d) => lower.includes(d))
}

export function extractLinks(text: string): ResumeLink[] {
  const links: ResumeLink[] = []
  const seen = new Set<string>()

  const classify = (url: string, hint: string): ResumeLink['type'] => {
    const lower = `${url} ${hint}`.toLowerCase()
    if (lower.includes('linkedin.com')) return 'linkedin'
    if (lower.includes('github.com')) return 'github'
    if (/portfolio|website|personal site|\b(site|web)\b/i.test(hint)) return 'portfolio'
    if (url.startsWith('mailto:') || /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(url)) return 'email'
    return 'other'
  }

  const add = (url: string, label: string, type?: ResumeLink['type']) => {
    const resolvedType = type ?? classify(url, label)
    const normalized = resolvedType === 'email' || url.startsWith('mailto:')
      ? (url.startsWith('mailto:') ? url : `mailto:${url}`)
      : normalizeUrl(url)
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    if (resolvedType !== 'email' && isBlockedDomain(normalized)) return
    seen.add(key)
    const displayLabel = resolvedType === 'email'
      ? label.replace(/^mailto:/, '')
      : resolvedType === 'linkedin'
        ? 'LinkedIn'
        : resolvedType === 'github'
          ? 'GitHub'
          : resolvedType === 'portfolio'
            ? (label && !/^portfolio$/i.test(label) ? label : 'Portfolio')
            : label
    links.push({ label: displayLabel, url: normalized, type: resolvedType })
  }

  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    add(cleanUrl(m[2]), m[1].trim())
  }

  for (const email of text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []) {
    add(email, email, 'email')
  }

  for (const m of text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+/gi) ?? []) {
    add(cleanUrl(m), 'LinkedIn', 'linkedin')
  }

  for (const m of text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w.-]+/gi) ?? []) {
    add(cleanUrl(m).replace(/\/+$/, ''), 'GitHub', 'github')
  }

  const portfolioPatterns = [
    /(?:portfolio|website|personal site|site)[:\s]+((?:https?:\/\/)?[\w.-]+\.[\w.-]+[\w./?=#%-]*)/gi,
    /((?:https?:\/\/)?[\w-]+\.(?:dev|io|me|app|xyz|vercel\.app|pages\.dev)(?:\/[\w./-]*)?)/gi,
  ]
  for (const pattern of portfolioPatterns) {
    for (const m of text.matchAll(pattern)) {
      const raw = cleanUrl(m[1] ?? m[0])
      const lower = raw.toLowerCase()
      if (lower.includes('linkedin.com') || lower.includes('github.com')) continue
      if (isBlockedDomain(lower)) continue
      add(raw, 'Portfolio', 'portfolio')
    }
  }

  for (const raw of text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]()]+/gi) ?? []) {
    const url = cleanUrl(raw)
    const lower = url.toLowerCase()
    if (lower.includes('linkedin.com')) { add(url, 'LinkedIn', 'linkedin'); continue }
    if (lower.includes('github.com')) { add(url, 'GitHub', 'github'); continue }
    if (isBlockedDomain(lower)) continue
    add(url, 'Portfolio', 'portfolio')
  }

  return links
}

function extractSkillGroups(text: string): SkillGroup[] {
  const section = extractSection(text, /\b(skills|technical skills)\b/i, SECTION_STOP)
  const source = section || text
  const groups: SkillGroup[] = []

  for (const line of source.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const catMatch = line.match(/^([^:]+):\s*(.+)$/)
    if (catMatch) {
      const skills = catMatch[2]
        .split(/[,;|•]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 40)
      if (skills.length) groups.push({ category: catMatch[1].trim(), skills })
    }
  }

  return groups.slice(0, 8)
}

function extractSkills(text: string, groups: SkillGroup[]): string[] {
  const fromGroups = groups.flatMap((g) => g.skills)
  if (fromGroups.length >= 5) {
    return [...new Set(fromGroups)].slice(0, 30)
  }

  const lower = text.toLowerCase()
  const keywordHits = SKILL_KEYWORDS.filter((s) => lower.includes(s.toLowerCase()))
  return [...new Set([...fromGroups, ...keywordHits])].slice(0, 30)
}

function parseMonthYear(token: string): Date | null {
  const cleaned = token.trim().toLowerCase()
  if (/present|current|now/i.test(cleaned)) return new Date()

  const monthYear = cleaned.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+(19|20)\d{2}/i,
  )
  if (monthYear) {
    const month = MONTH_MAP[monthYear[1].slice(0, 3).toLowerCase()]
    const year = parseInt(monthYear[0].match(/\d{4}/)![0], 10)
    return new Date(year, month, 1)
  }

  const yearOnly = cleaned.match(/\b(19|20)\d{2}\b/)
  if (yearOnly) return new Date(parseInt(yearOnly[0], 10), 0, 1)

  return null
}

function parseDateRange(period: string): { start: Date; end: Date } | null {
  const m = period.match(
    /(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(20\d{2}|19\d{2})\s*[-–—]+\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(20\d{2}|19\d{2}|present|current|now)/i,
  )
  if (!m) return null

  const startStr = m[1] ? `${m[1]} ${m[2]}` : m[2]
  const endStr = /present|current|now/i.test(m[4]) ? 'present' : m[3] ? `${m[3]} ${m[4]}` : m[4]

  const start = parseMonthYear(startStr)
  const end = parseMonthYear(endStr)
  if (!start || !end || end < start) return null
  return { start, end }
}

export function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
}

function looksLikeBullet(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^[•\-\*●▪]/.test(t)) return true
  if (t.length > 110) return true
  if (/^(implemented|developed|built|designed|created|documented|achieved|reduced|increased|collaborated|optimized|leveraged|automated|integrated|deployed|engineered|supported|improved|fine-tuned|architected)/i.test(t)) return true
  if (/^\(from\s/i.test(t)) return true
  if (/\d+%/.test(t) && !t.includes('|')) return true
  if (/\b(by \d+%|failure rate|satisfaction rating|escalation|accuracy)\b/i.test(t)) return true
  return false
}

function isMostlyDateLine(line: string): boolean {
  const t = line.trim()
  if (t.length > 55) return false
  if (looksLikeBullet(t)) return false
  return DATE_ONLY_LINE.test(t)
}

function stripTrailingDate(line: string): string {
  return line.replace(/\s+(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:19|20)\d{2}\s*[-–—]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:(?:19|20)\d{2}|present|current|now)\.?\s*(\(expected\))?\s*$/i, '').trim()
}

function parseCompanyTitle(line: string): { company: string; title: string } | null {
  const cleaned = stripTrailingDate(line.trim())
  if (!cleaned || looksLikeBullet(cleaned)) return null

  if (cleaned.includes('|')) {
    const pipeIdx = cleaned.indexOf('|')
    const company = cleaned.slice(0, pipeIdx).trim()
    const title = cleaned.slice(pipeIdx + 1).trim()
    if (company.length >= 2 && title.length >= 3) return { company, title }
  }

  const tabParts = cleaned.split('\t').map((p) => p.trim()).filter(Boolean)
  if (tabParts.length === 2 && tabParts[0].length >= 2 && tabParts[1].length >= 3) {
    return { company: tabParts[0], title: tabParts[1] }
  }

  const dashMatch = cleaned.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (dashMatch && dashMatch[1].length < 50 && dashMatch[2].length < 60) {
    return { company: dashMatch[1].trim(), title: dashMatch[2].trim() }
  }

  if (/\b(engineer|developer|intern|analyst|consultant|manager|support|researcher|architect|lead|specialist|participant)\b/i.test(cleaned) && cleaned.length < 90) {
    return { company: '', title: cleaned }
  }

  return null
}

function isEducationEntry(company: string, title: string): boolean {
  const combined = `${company} ${title}`.toLowerCase()
  if (/intern|engineer|developer|analyst|consultant|manager|support|specialist|researcher|teaching|fellow/i.test(combined)) {
    return false
  }
  if (/university|college|institute|school/i.test(combined) && !/intern/i.test(combined)) {
    return true
  }
  return /bachelor|master|b\.s|b\.tech|m\.s|mba|ph\.d|degree|expected|\bstudent\b|coursework/i.test(combined)
}

function isNonEmploymentEntry(company: string, title: string): boolean {
  if (isEducationEntry(company, title)) return true
  const combined = `${company} ${title}`.toLowerCase()
  if (/summer school|selected participant|certified engineer|certification program|honor roll|dean's list|scholarship|hackathon winner|competition/i.test(combined)) {
    return true
  }
  if (/^amazon\b/i.test(company) && /participant|school/i.test(title)) return true
  if (/^sophos\b/i.test(company) && /certified/i.test(title)) return true
  return false
}

function findRoleHeader(lines: string[], dateIndex: number): { company: string; title: string } | null {
  for (let j = dateIndex - 1; j >= Math.max(0, dateIndex - 5); j--) {
    const parsed = parseCompanyTitle(lines[j])
    if (parsed && (parsed.company || parsed.title)) return parsed
  }
  return null
}

function collectRoleBullets(lines: string[], startIndex: number): string[] {
  const bullets: string[] = []
  for (let j = startIndex + 1; j < lines.length; j++) {
    const t = lines[j].trim()
    if (!t) continue
    if (isMostlyDateLine(t) || INLINE_ROLE_DATE.test(t)) break
    const header = parseCompanyTitle(t)
    if (header && !looksLikeBullet(t) && !/^[•\-\*●▪]/.test(t)) break
    if (/^[•\-\*●▪]/.test(t)) {
      bullets.push(t.replace(/^[•\-\*●▪]\s+/, '').trim())
    } else if (looksLikeBullet(t) && t.length > 20) {
      bullets.push(t)
    }
    if (bullets.length >= 5) break
  }
  return bullets
}

function parseRolesFromLines(lines: string[]): ExperienceEntry[] {
  const experiences: ExperienceEntry[] = []
  const seenPeriods = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const inlineMatch = line.match(INLINE_ROLE_DATE)
    if (inlineMatch) {
      const role = parseCompanyTitle(inlineMatch[1])
      const period = inlineMatch[2].trim()
      if (role && !isNonEmploymentEntry(role.company, role.title)) {
        const range = parseDateRange(period)
        if (range && !seenPeriods.has(period)) {
          seenPeriods.add(period)
          experiences.push({
            title: role.title || role.company,
            company: role.title ? role.company : '',
            period,
            months: monthsBetween(range.start, range.end),
            type: classifyRoleType(role.title || role.company, role.company),
            highlights: collectRoleBullets(lines, i),
          })
        }
      }
      continue
    }

    if (!isMostlyDateLine(line)) continue

    const period = line.match(
      /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:19|20)\d{2}\s*[-–—]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:(?:19|20)\d{2}|present|current|now)/i,
    )?.[0]
    if (!period || seenPeriods.has(period)) continue

    const range = parseDateRange(period)
    if (!range) continue

    const role = findRoleHeader(lines, i)
    if (!role) continue
    if (isNonEmploymentEntry(role.company, role.title)) continue

    seenPeriods.add(period)
    experiences.push({
      title: role.title || role.company,
      company: role.title ? role.company : '',
      period,
      months: monthsBetween(range.start, range.end),
      type: classifyRoleType(role.title || role.company, role.company),
      highlights: collectRoleBullets(lines, i),
    })
  }

  return experiences
}

function extractExperiences(text: string): ExperienceEntry[] {
  const section = extractSection(text, EXPERIENCE_HEADER, SECTION_STOP)
  if (section) {
    const lines = section.split('\n').map((l) => l.trim()).filter(Boolean)
    const roles = parseRolesFromLines(lines)
    if (roles.length > 0) return roles.slice(0, 8)
  }

  // PDFs sometimes place EDUCATION before EXPERIENCE — never use pre-education fallback
  return []
}

export function classifyRoleType(title: string, company: string): ExperienceEntry['type'] {
  const combined = `${title} ${company}`.toLowerCase()
  if (/\bintern(ship)?\b|\bco-op\b|\bcoop\b|\btrainee\b|\bsummer analyst\b|\bextern\b|\bresearch intern\b/.test(combined)) {
    return 'intern'
  }
  if (/\bcontract(or|ual)?\b|\bconsultant\b|\bfreelance\b|\bc2c\b|\b1099\b/.test(combined)) {
    return 'contract'
  }
  return 'fulltime'
}

export function sumEmploymentMonths(experiences: ExperienceEntry[]): number {
  const ranges = experiences
    .map((e) => parseDateRange(e.period))
    .filter((r): r is { start: Date; end: Date } => r != null)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  if (ranges.length === 0) return 0

  const merged: Array<{ start: Date; end: Date }> = [{ ...ranges[0] }]
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1]
    if (ranges[i].start <= last.end) {
      if (ranges[i].end > last.end) last.end = ranges[i].end
    } else {
      merged.push({ ...ranges[i] })
    }
  }

  return merged.reduce((sum, r) => sum + monthsBetween(r.start, r.end), 0)
}

export function formatExperienceLabel(totalMonths: number): string {
  if (totalMonths <= 0) return ''
  if (totalMonths < 12) return `${totalMonths} mo`
  const years = Math.round((totalMonths / 12) * 10) / 10
  if (years < 2) return `${years} yrs`
  return `${Math.round(years)} yrs`
}

export function buildExperienceBreakdown(experiences: ExperienceEntry[]): ExperienceBreakdown | null {
  if (experiences.length === 0) return null

  const fullTime = experiences.filter((e) => e.type === 'fulltime')
  const intern = experiences.filter((e) => e.type === 'intern')
  const contract = experiences.filter((e) => e.type === 'contract')

  const fullTimeMonths = sumEmploymentMonths(fullTime)
  const internMonths = sumEmploymentMonths(intern)
  const contractMonths = sumEmploymentMonths(contract)
  const totalMonths = fullTimeMonths + internMonths + contractMonths

  return {
    fullTimeMonths,
    internMonths,
    contractMonths,
    fullTimeLabel: fullTimeMonths > 0 ? formatExperienceLabel(fullTimeMonths) : '—',
    internLabel: internMonths > 0 ? formatExperienceLabel(internMonths) : '—',
    contractLabel: contractMonths > 0 ? formatExperienceLabel(contractMonths) : '—',
    totalLabel: totalMonths > 0 ? formatExperienceLabel(totalMonths) : '—',
    fullTimeRoles: fullTime.length,
    internRoles: intern.length,
  }
}

function calculateExperienceFromRoles(
  experiences: ExperienceEntry[],
  text: string,
): { years: number | null; months: number | null; label: string | null } {
  const totalMonths = sumEmploymentMonths(experiences)
  if (totalMonths <= 0) {
    const explicit = text.match(/(\d+(?:\.\d+)?)\+?\s*years?\s*(?:of\s*)?(?:professional\s*)?(?:work\s*)?(?:experience|exp)/i)
    if (explicit) {
      const y = parseFloat(explicit[1])
      return { years: y, months: Math.round(y * 12), label: `${y}+ yrs` }
    }
    return { years: null, months: null, label: null }
  }

  const years = Math.round((totalMonths / 12) * 10) / 10
  return {
    years,
    months: totalMonths,
    label: formatExperienceLabel(totalMonths),
  }
}

function extractEducation(text: string): EducationEntry[] {
  const section = extractSection(text, /\beducation\b/i, SECTION_STOP)
  if (!section) return []

  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean)
  const entries: EducationEntry[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const inlineDate = stripTrailingDate(line)
    const schoolLine = inlineDate !== line ? inlineDate : line

    const isSchool =
      /university|college|institute|school/i.test(schoolLine) &&
      !/bachelor|master|b\.|m\.|ph\.|degree|gpa/i.test(schoolLine)

    const dateOnNext = i + 1 < lines.length && isMostlyDateLine(lines[i + 1])
    const dateInline = line.match(
      /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:19|20)\d{2}\s*[-–—]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:(?:19|20)\d{2}|present|current|now)/i,
    )?.[0]

    if (!isSchool && !dateOnNext && !dateInline) continue

    const school = isSchool ? schoolLine.replace(/\s+\|.*/, '').trim() : ''
    let period = dateInline ?? ''
    if (!period && dateOnNext) {
      period = lines[i + 1].match(
        /(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:19|20)\d{2}\s*[-–—]+\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]*)?(?:(?:19|20)\d{2}|present|current|now)/i,
      )?.[0] ?? ''
    }

    let degree = ''
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      if (/bachelor|master|b\.|m\.|ph\.|doctor|diploma|gpa|technology|science|engineering/i.test(lines[j])) {
        degree = lines[j].replace(/\s*\(.*?\)\s*/g, ' ').trim()
        break
      }
    }

    if (school || degree) {
      entries.push({
        school: school || degree.split(',')[0]?.trim() || 'School',
        degree: degree || schoolLine,
        year: period.match(/\b(19|20)\d{2}\b/g)?.join(' – ') ?? '',
        period: period || '',
      })
      if (dateOnNext) i++
    }
  }

  return entries.slice(0, 4)
}

function extractProjects(text: string): ProjectEntry[] {
  const section = extractSection(text, /\bprojects\b/i, SECTION_STOP)
  if (!section) return []

  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean)
  const projects: ProjectEntry[] = []
  let current: ProjectEntry | null = null

  for (const line of lines) {
    if (/^[•\-\*●▪]/.test(line) || looksLikeBullet(line)) {
      if (current) {
        current.highlights.push(line.replace(/^[•\-\*●▪]\s+/, '').trim())
      }
      continue
    }

    if (current && current.highlights.length) projects.push(current)

    const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/github\.com[^)]+)\)/i)
    current = {
      name: linkMatch ? line.replace(/\[([^\]]+)\]\([^)]+\)/, '$1').trim() : line.replace(/\s*\[?Github\]?.*$/i, '').trim(),
      highlights: [],
      link: linkMatch?.[2] ?? null,
    }
  }

  if (current && (current.highlights.length || current.name)) projects.push(current)
  return projects.slice(0, 6)
}

function extractHighlights(experiences: ExperienceEntry[]): string[] {
  return experiences
    .flatMap((e) => e.highlights)
    .filter((h) => h.length > 15)
    .slice(0, 6)
}

function formatDisplayName(raw: string): string {
  const trimmed = raw.trim()
  if (/^[A-Z\s]{4,}$/.test(trimmed) && trimmed.includes(' ')) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }
  return trimmed
}

function extractName(text: string, email: string | null): string | null {
  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 2 && l.length < 70)
  if (firstLine && !firstLine.includes('@') && !/resume|curriculum|vitae|linkedin|github|portfolio/i.test(firstLine)) {
    return formatDisplayName(firstLine.split('|')[0].trim())
  }
  if (email) {
    return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return null
}

function extractLocation(text: string): string | null {
  const header = text.split('\n').slice(0, 6).join('\n')
  const match = header.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})\b/)
  return match?.[1] ?? null
}

export function buildMetrics(
  breakdown: ExperienceBreakdown | null,
  experiences: ExperienceEntry[],
  skillCount: number,
): ResumeProfile['metrics'] {
  if (!breakdown) return []
  const metrics: ResumeProfile['metrics'] = []
  if (breakdown.fullTimeMonths > 0) metrics.push({ label: 'Full-time', value: breakdown.fullTimeLabel, icon: '💼' })
  if (breakdown.internMonths > 0) metrics.push({ label: 'Internships', value: breakdown.internLabel, icon: '🎓' })
  metrics.push({ label: 'Total experience', value: breakdown.totalLabel, icon: '⏱' })
  metrics.push({ label: 'Roles', value: String(experiences.length), icon: '📋' })
  if (skillCount > 0) metrics.push({ label: 'Skills', value: String(skillCount), icon: '⚡' })
  return metrics
}

export function buildResumeProfile(rawText: string): ResumeProfile {
  const text = normalizeResumeText(rawText)
  const links = extractLinks(text)
  const email = links.find((l) => l.type === 'email')?.label ?? text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null
  const phone = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] ?? null
  const skillGroups = extractSkillGroups(text)
  const skills = extractSkills(text, skillGroups)
  const experiences = extractExperiences(text)
  const breakdown = buildExperienceBreakdown(experiences)
  const { years, months, label } = calculateExperienceFromRoles(experiences, text)
  const education = extractEducation(text)
  const projects = extractProjects(text)
  const highlights = extractHighlights(experiences)
  const name = extractName(text, email)
  const location = extractLocation(text)

  return {
    name,
    location,
    email,
    phone,
    links,
    skills,
    skillGroups,
    totalYearsExperience: years,
    totalMonthsExperience: months,
    experienceLabel: breakdown?.totalLabel ?? label,
    experienceBreakdown: breakdown,
    experiences,
    education,
    projects,
    highlights,
    metrics: buildMetrics(breakdown, experiences, skills.length),
  }
}
