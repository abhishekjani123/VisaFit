export interface LinkedInSearchParams {
  keywords: string
  geoId: string | null
  location: string | null
  fE: string | null
  fTPR: string | null
  fJT: string | null
  fWT: string | null
  distance: string | null
  originalUrl: string
}

export interface JobStub {
  linkedinJobId: string
  title: string
  company: string
  location: string
  postedDate: string
  url: string
}

const GUEST_SEARCH =
  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const GUEST_JOB = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting'

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function parseSearchUrl(inputUrl: string): LinkedInSearchParams {
  let url: URL
  try {
    url = new URL(inputUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (!url.hostname.includes('linkedin.com')) {
    throw new Error('URL must be a LinkedIn jobs search URL')
  }

  const get = (key: string) => url.searchParams.get(key)

  return {
    keywords: get('keywords') ?? get('keyword') ?? '',
    geoId: get('geoId'),
    location: get('location'),
    fE: get('f_E'),
    fTPR: get('f_TPR'),
    fJT: get('f_JT'),
    fWT: get('f_WT'),
    distance: get('distance'),
    originalUrl: inputUrl,
  }
}

function buildSearchQuery(params: LinkedInSearchParams, start: number): string {
  const q = new URLSearchParams()
  if (params.keywords) q.set('keywords', params.keywords)
  if (params.geoId) q.set('geoId', params.geoId)
  if (params.location) q.set('location', params.location)
  if (params.fE) q.set('f_E', params.fE)
  if (params.fTPR) q.set('f_TPR', params.fTPR)
  if (params.fJT) q.set('f_JT', params.fJT)
  if (params.fWT) q.set('f_WT', params.fWT)
  if (params.distance) q.set('distance', params.distance)
  q.set('start', String(start))
  return `${GUEST_SEARCH}?${q.toString()}`
}

async function guestFetch(url: string): Promise<string> {
  const proxy = process.env.SCRAPER_PROXY_URL
  const fetchUrl = proxy ? `${proxy}?url=${encodeURIComponent(url)}` : url

  const res = await fetch(fetchUrl, {
    headers: {
      'User-Agent': randomUA(),
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (res.status === 429) throw new Error('LinkedIn rate limit — try again in a few minutes')
  if (!res.ok) throw new Error(`LinkedIn fetch failed (${res.status})`)
  return res.text()
}

function parseJobCards(html: string): JobStub[] {
  const stubs: JobStub[] = []
  const cardRegex = /<li[^>]*>[\s\S]*?<\/li>/gi
  const cards = html.match(cardRegex) ?? []

  for (const card of cards) {
    const idMatch =
      card.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/) ??
      card.match(/\/jobs\/view\/(\d+)/)
    if (!idMatch) continue

    const linkedinJobId = idMatch[1]
    const titleMatch = card.match(/class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\//)
    const companyMatch = card.match(/class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\//)
    const locationMatch = card.match(/class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\//)
    const dateMatch = card.match(/<time[^>]*datetime="([^"]+)"/)

    const clean = (s: string) => s.replace(/<[^>]+>/g, '').trim()

    stubs.push({
      linkedinJobId,
      title: titleMatch ? clean(titleMatch[1]) : '',
      company: companyMatch ? clean(companyMatch[1]) : '',
      location: locationMatch ? clean(locationMatch[1]) : '',
      postedDate: dateMatch?.[1] ?? '',
      url: `https://www.linkedin.com/jobs/view/${linkedinJobId}`,
    })
  }

  return stubs
}

export async function fetchJobStubs(
  params: LinkedInSearchParams,
  maxPages = 10,
): Promise<JobStub[]> {
  const all: JobStub[] = []
  const seen = new Set<string>()

  for (let page = 0; page < maxPages; page++) {
    const start = page * 25
    const url = buildSearchQuery(params, start)
    const html = await guestFetch(url)
    const batch = parseJobCards(html)

    if (batch.length === 0) break

    for (const stub of batch) {
      if (!seen.has(stub.linkedinJobId)) {
        seen.add(stub.linkedinJobId)
        all.push(stub)
      }
    }

    if (batch.length < 10) break
    await sleep(3000 + Math.random() * 2000)
  }

  return all
}

import type { JobMeta } from './types'

export interface JobDetail {
  text: string
  meta: JobMeta
}

export const EMPTY_JOB_META: JobMeta = {
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
}

function parsePostedDaysAgo(text: string): number | null {
  const lower = text.toLowerCase()
  const numMatch = lower.match(/(\d+)\s+(day|week|month|year)s?\s+ago/)
  if (!numMatch) return null
  const n = parseInt(numMatch[1], 10)
  const unit = numMatch[2]
  if (unit.startsWith('day')) return n
  if (unit.startsWith('week')) return n * 7
  if (unit.startsWith('month')) return n * 30
  if (unit.startsWith('year')) return n * 365
  return null
}

function parseApplicantCount(text: string): number | null {
  const lower = text.toLowerCase()
  const overMatch = lower.match(/over\s+(\d+)/)
  if (overMatch) return parseInt(overMatch[1], 10)
  const numMatch = lower.match(/(\d+)\s+applicants?/)
  if (numMatch) return parseInt(numMatch[1], 10)
  return null
}

export function parseJobMetaFromHtml(html: string): JobMeta {
  const meta = { ...EMPTY_JOB_META }

  const applicantMatch =
    html.match(/class="[^"]*num-applicants__caption[^"]*"[^>]*>([^<]+)</i) ??
    html.match(/(\d+\+?\s+applicants?)/i) ??
    html.match(/(Over\s+\d+\s+applicants?)/i)
  if (applicantMatch) {
    meta.applicantText = applicantMatch[1].replace(/<[^>]+>/g, '').trim()
    meta.applicantCount = parseApplicantCount(meta.applicantText)
  }

  const postedMatch =
    html.match(/class="[^"]*posted-time-ago__text[^"]*"[^>]*>([^<]+)</i) ??
    html.match(/(?:Reposted|Posted)\s+[\d\s\w]+ ago/i)
  if (postedMatch) {
    meta.postedAgo = postedMatch[0]?.includes('<') ? postedMatch[1].trim() : postedMatch[0].trim()
    meta.reposted = /reposted/i.test(meta.postedAgo)
    meta.postedDaysAgo = parsePostedDaysAgo(meta.postedAgo)
  }

  meta.activelyRecruiting =
    /actively-recruiting|actively hiring|actively recruiting/i.test(html)

  const criteriaRegex =
    /class="[^"]*description__job-criteria-item[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi
  let criteriaMatch
  while ((criteriaMatch = criteriaRegex.exec(html)) !== null) {
    const label = criteriaMatch[1].trim().toLowerCase()
    const value = criteriaMatch[2].trim()
    if (label.includes('employment type')) meta.employmentType = value
    else if (label.includes('seniority')) meta.seniority = value
    else if (label.includes('job function')) meta.jobFunctions.push(value)
    else if (label.includes('industr')) meta.industries.push(value)
  }

  return meta
}

function extractDescriptionText(html: string): string {
  const descMatch =
    html.match(/class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/) ??
    html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/)

  if (!descMatch) {
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ')
    return text.replace(/\s+/g, ' ').trim().slice(0, 15_000)
  }

  return descMatch[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
}

export async function fetchJobDetail(linkedinJobId: string): Promise<JobDetail> {
  const html = await guestFetch(`${GUEST_JOB}/${linkedinJobId}`)
  return {
    text: extractDescriptionText(html),
    meta: parseJobMetaFromHtml(html),
  }
}

export async function fetchJobDescription(linkedinJobId: string): Promise<string> {
  const detail = await fetchJobDetail(linkedinJobId)
  return detail.text
}
