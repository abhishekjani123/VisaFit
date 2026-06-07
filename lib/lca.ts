import type { SignalColor, ValidationLink } from './types'
import { queryAll, queryOne } from './db/client'
import { normalizeEmployer, canonicalFromAlias } from './normalize-employer'
import fallbackData from '../data/lca.json'

const RECENT_FYS = ['FY2025', 'FY2024', 'FY2026']

export interface LCAResult {
  signal: SignalColor
  trend: 'rising' | 'stable' | 'declining' | 'stale' | 'none'
  reason: string
  filings: Record<string, number>
  medianWage: number | null
  topTitles: string[]
  approvalRate: number | null
  matchType: 'exact' | 'alias' | 'fuzzy' | 'fallback' | 'none'
  caveat: string
  validationLinks: ValidationLink[]
}

interface EmployerRow extends Record<string, unknown> {
  employer_norm: string
  employer_display: string
  fiscal_year: string
  certified: number
  denied: number
  withdrawn: number
  median_wage: number | null
  top_titles: string | null
}

interface USCISRow extends Record<string, unknown> {
  initial_approved: number
  initial_denied: number
  continuing_approved: number
  continuing_denied: number
}

const LCA_CAVEAT =
  'LCA certification indicates intent to sponsor; it does not guarantee USCIS petition approval.'

function buildValidationLinks(companyName: string): ValidationLink[] {
  const q = encodeURIComponent(companyName)
  return [
    {
      label: 'DOL LCA Disclosure Data (source)',
      url: 'https://www.dol.gov/agencies/eta/foreign-labor/performance',
    },
    {
      label: 'USCIS H-1B Employer Data Hub',
      url: 'https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub',
    },
    {
      label: `Verify "${companyName}" on h1bdata.info`,
      url: `https://h1bdata.info/index.php?em=${q}`,
    },
  ]
}

function deriveTrend(filings: Record<string, number>): LCAResult['trend'] {
  const sorted = Object.entries(filings).sort(([a], [b]) => a.localeCompare(b))
  if (sorted.length < 2) return 'none'
  const values = sorted.map(([, v]) => v)
  const delta = values[values.length - 1] - values[0]
  if (delta > 5) return 'rising'
  if (delta < -5) return 'declining'
  return 'stable'
}

function deriveSignal(
  filings: Record<string, number>,
  recentTotal: number,
  olderTotal: number,
): SignalColor {
  if (recentTotal >= 5) return 'green'
  if (recentTotal >= 1) return 'yellow'
  if (olderTotal >= 5) return 'yellow'
  if (Object.values(filings).some((v) => v > 0)) return 'yellow'
  return 'red'
}

function buildReason(
  signal: SignalColor,
  recentTotal: number,
  olderTotal: number,
  trend: LCAResult['trend'],
  matchType: LCAResult['matchType'],
  displayName: string,
): string {
  const matchNote =
    matchType === 'fuzzy' ? ` (fuzzy match on "${displayName}")` : matchType === 'alias' ? ' (via known alias)' : ''

  if (signal === 'green') {
    return `${recentTotal} certified H-1B LCA filings in recent fiscal years${matchNote}. Strong sponsorship signal. Trend: ${trend}.`
  }
  if (signal === 'yellow' && recentTotal >= 1) {
    return `${recentTotal} recent LCA filing(s) for ${displayName}${matchNote}. Sponsorship possible but limited volume — confirm with recruiter.`
  }
  if (signal === 'yellow' && olderTotal >= 5) {
    return `Sponsored historically (${olderTotal} older filings) but recent activity dropped${matchNote}. Confirm before investing interview time.`
  }
  return `No LCA filing history found for "${displayName}"${matchNote}. Assume no sponsorship unless explicitly confirmed in the JD.`
}

async function lookupFromDb(norm: string): Promise<{
  rows: EmployerRow[]
  matchType: LCAResult['matchType']
  displayName: string
} | null> {
  // 1. Exact match
  let rows = await queryAll<EmployerRow>(
    'SELECT * FROM employer_lca WHERE employer_norm = ? ORDER BY fiscal_year',
    [norm],
  )
  if (rows.length > 0) {
    return { rows, matchType: 'exact', displayName: rows[0].employer_display }
  }

  // 2. Alias table
  const alias = await queryOne<{ canonical_norm: string }>(
    'SELECT canonical_norm FROM employer_alias WHERE alias_norm = ?',
    [norm],
  )
  if (alias) {
    rows = await queryAll<EmployerRow>(
      'SELECT * FROM employer_lca WHERE employer_norm = ? ORDER BY fiscal_year',
      [alias.canonical_norm],
    )
    if (rows.length > 0) {
      return { rows, matchType: 'alias', displayName: rows[0].employer_display }
    }
  }

  // 3. Built-in alias groups
  const canonical = canonicalFromAlias(norm)
  if (canonical && canonical !== norm) {
    rows = await queryAll<EmployerRow>(
      'SELECT * FROM employer_lca WHERE employer_norm = ? ORDER BY fiscal_year',
      [canonical],
    )
    if (rows.length > 0) {
      return { rows, matchType: 'alias', displayName: rows[0].employer_display }
    }
  }

  // 4. Fuzzy: contains match, prefer highest recent filings
  rows = await queryAll<EmployerRow>(
    `SELECT * FROM employer_lca
     WHERE employer_norm LIKE ? OR employer_display LIKE ?
     ORDER BY certified DESC LIMIT 20`,
    [`%${norm}%`, `%${norm}%`],
  )
  if (rows.length > 0) {
    const byEmployer = new Map<string, EmployerRow[]>()
    for (const row of rows) {
      const list = byEmployer.get(row.employer_norm) ?? []
      list.push(row)
      byEmployer.set(row.employer_norm, list)
    }
    const best = [...byEmployer.entries()].sort((a, b) => {
      const sumA = a[1].reduce((s, r) => s + r.certified, 0)
      const sumB = b[1].reduce((s, r) => s + r.certified, 0)
      return sumB - sumA
    })[0]
    return { rows: best[1], matchType: 'fuzzy', displayName: best[1][0].employer_display }
  }

  return null
}

async function lookupUSCIS(employerNorm: string): Promise<number | null> {
  try {
    const row = await queryOne<USCISRow>(
      `SELECT SUM(initial_approved) as initial_approved, SUM(initial_denied) as initial_denied,
              SUM(continuing_approved) as continuing_approved, SUM(continuing_denied) as continuing_denied
       FROM uscis_approvals WHERE employer_norm = ? OR employer_norm LIKE ?`,
      [employerNorm, `%${employerNorm}%`],
    )
    if (!row) return null
    const approved = (row.initial_approved ?? 0) + (row.continuing_approved ?? 0)
    const denied = (row.initial_denied ?? 0) + (row.continuing_denied ?? 0)
    const total = approved + denied
    if (total === 0) return null
    return Math.round((approved / total) * 100)
  } catch {
    return null
  }
}

function lookupFallback(rawCompanyName: string): LCAResult {
  const norm = normalizeEmployer(rawCompanyName)
  const data = fallbackData as Record<string, Record<string, number>>

  let filings: Record<string, number> | null = data[norm] ?? null
  if (!filings) {
    for (const key of Object.keys(data)) {
      if (key.includes(norm) || norm.includes(key)) {
        filings = data[key]
        break
      }
    }
  }

  if (!filings || Object.keys(filings).length === 0) {
    return {
      signal: 'red',
      trend: 'none',
      reason: `No LCA filing history found for "${rawCompanyName}" (fallback dataset). Assume no sponsorship without explicit confirmation.`,
      filings: {},
      medianWage: null,
      topTitles: [],
      approvalRate: null,
      matchType: 'fallback',
      caveat: LCA_CAVEAT,
      validationLinks: buildValidationLinks(rawCompanyName),
    }
  }

  const recentTotal = RECENT_FYS.reduce((sum, fy) => sum + (filings![fy] ?? 0), 0)
  const olderTotal = Object.entries(filings)
    .filter(([fy]) => !RECENT_FYS.includes(fy))
    .reduce((sum, [, v]) => sum + v, 0)
  const trend = deriveTrend(filings)
  const signal = deriveSignal(filings, recentTotal, olderTotal)

  return {
    signal,
    trend,
    reason: buildReason(signal, recentTotal, olderTotal, trend, 'fallback', rawCompanyName),
    filings,
    medianWage: null,
    topTitles: [],
    approvalRate: null,
    matchType: 'fallback',
    caveat: LCA_CAVEAT,
    validationLinks: buildValidationLinks(rawCompanyName),
  }
}

export async function lookupLCA(rawCompanyName: string): Promise<LCAResult> {
  const norm = normalizeEmployer(rawCompanyName)

  try {
    const match = await lookupFromDb(norm)
    if (!match) {
      return lookupFallback(rawCompanyName)
    }

    const filings: Record<string, number> = {}
    let medianWage: number | null = null
    let topTitles: string[] = []

    for (const row of match.rows) {
      filings[row.fiscal_year] = (filings[row.fiscal_year] ?? 0) + row.certified
      if (row.median_wage && !medianWage) medianWage = row.median_wage
      if (row.top_titles && topTitles.length === 0) {
        topTitles = row.top_titles.split('|').filter(Boolean)
      }
    }

    const recentTotal = RECENT_FYS.reduce((sum, fy) => sum + (filings[fy] ?? 0), 0)
    const olderTotal = Object.entries(filings)
      .filter(([fy]) => !RECENT_FYS.includes(fy))
      .reduce((sum, [, v]) => sum + v, 0)

    const trend = deriveTrend(filings)
    const signal = deriveSignal(filings, recentTotal, olderTotal)
    const approvalRate = await lookupUSCIS(match.rows[0].employer_norm)

    return {
      signal,
      trend,
      reason: buildReason(signal, recentTotal, olderTotal, trend, match.matchType, match.displayName),
      filings,
      medianWage,
      topTitles,
      approvalRate,
      matchType: match.matchType,
      caveat: LCA_CAVEAT,
      validationLinks: buildValidationLinks(match.displayName),
    }
  } catch {
    return lookupFallback(rawCompanyName)
  }
}

/** Sync fallback for scripts/tests */
export function lookupLCASync(rawCompanyName: string): LCAResult {
  return lookupFallback(rawCompanyName)
}
