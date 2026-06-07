#!/usr/bin/env npx ts-node
/**
 * DOL LCA Disclosure Data ingestion pipeline.
 *
 * Downloads quarterly XLSX files from DOL OFLC, aggregates certified H-1B
 * filings per employer per fiscal year, and loads into SQLite/Turso.
 *
 * Usage:
 *   npm run build:lca                    # download latest quarters + build
 *   npm run build:lca -- --local         # use scripts/input/*.xlsx only
 *   npm run build:lca -- --seed-only     # seed from data/lca.json fallback
 *   npm run build:lca -- --fy 2025 --q 4 # specific quarter
 */

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@libsql/client'
import {
  normalizeEmployer,
  EMPLOYER_ALIAS_GROUPS,
  canonicalFromAlias,
} from '../lib/normalize-employer'

const CACHE_DIR = path.resolve(__dirname, 'input')
const DB_PATH = path.resolve(__dirname, '../data/visafit.db')
const FALLBACK_JSON = path.resolve(__dirname, '../data/lca.json')
const SCHEMA_PATH = path.resolve(__dirname, '../lib/db/schema.sql')

const DOL_URL_TEMPLATE =
  'https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY{year}_Q{quarter}.xlsx'

interface AggregateRow {
  employerNorm: string
  employerDisplay: string
  fiscalYear: string
  certified: number
  denied: number
  withdrawn: number
  wages: number[]
  titles: Map<string, number>
}

interface CliArgs {
  local: boolean
  seedOnly: boolean
  quarters: Array<{ year: number; quarter: number }>
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const local = args.includes('--local')
  const seedOnly = args.includes('--seed-only')
  const quarters: Array<{ year: number; quarter: number }> = []

  const fyIdx = args.indexOf('--fy')
  const qIdx = args.indexOf('--q')
  if (fyIdx !== -1 && qIdx !== -1) {
    quarters.push({ year: parseInt(args[fyIdx + 1], 10), quarter: parseInt(args[qIdx + 1], 10) })
  } else if (!local && !seedOnly) {
    // Default: last 8 quarters (FY2024 Q1 through FY2026 Q1)
    for (const spec of [
      { year: 2024, quarter: 1 },
      { year: 2024, quarter: 2 },
      { year: 2024, quarter: 3 },
      { year: 2024, quarter: 4 },
      { year: 2025, quarter: 1 },
      { year: 2025, quarter: 2 },
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 4 },
      { year: 2026, quarter: 1 },
    ]) {
      quarters.push(spec)
    }
  }

  return { local, seedOnly, quarters }
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  if (fs.existsSync(dest)) {
    console.log(`  cached: ${path.basename(dest)}`)
    return true
  }

  console.log(`  downloading: ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  skip (HTTP ${res.status}): ${url}`)
      return false
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, buffer)
    return true
  } catch (err) {
    console.warn(`  skip (network error): ${url}`, err instanceof Error ? err.message : err)
    return false
  }
}

function fiscalYearFromRow(row: Record<string, string>): string {
  const fy =
    row['FISCAL_YEAR'] ??
    row['Fiscal Year'] ??
    row['FY'] ??
    row['DECISION_DATE']?.slice(0, 4) ??
    ''
  if (fy.startsWith('FY')) return fy
  if (/^\d{4}$/.test(fy)) return `FY${fy}`
  return fy ? `FY${fy}` : 'FYUNKNOWN'
}

function parseWorkbook(filePath: string): Map<string, AggregateRow> {
  const aggregate = new Map<string, AggregateRow>()
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

  for (const row of rows) {
    const visaClass = row['VISA_CLASS'] ?? row['Visa Class'] ?? ''
    if (visaClass && visaClass !== 'H-1B') continue

    const status = row['CASE_STATUS'] ?? row['Case Status'] ?? ''
    const employer = row['EMPLOYER_NAME'] ?? row['Employer Name'] ?? ''
    if (!employer) continue

    const fy = fiscalYearFromRow(row)
    const norm = normalizeEmployer(employer)
    const canonical = canonicalFromAlias(norm) ?? norm
    const key = `${canonical}|${fy}`

    if (!aggregate.has(key)) {
      aggregate.set(key, {
        employerNorm: canonical,
        employerDisplay: employer.trim(),
        fiscalYear: fy,
        certified: 0,
        denied: 0,
        withdrawn: 0,
        wages: [],
        titles: new Map(),
      })
    }

    const entry = aggregate.get(key)!
    if (status === 'Certified') entry.certified++
    else if (status === 'Denied') entry.denied++
    else if (status === 'Withdrawn') entry.withdrawn++
    else continue

    const wage = parseFloat(row['WAGE_RATE_OF_PAY_FROM'] ?? row['Prevailing Wage'] ?? '')
    if (!isNaN(wage) && wage > 0) entry.wages.push(wage)

    const title = (row['JOB_TITLE'] ?? row['Job Title'] ?? '').trim()
    if (title) {
      entry.titles.set(title, (entry.titles.get(title) ?? 0) + 1)
    }
  }

  return aggregate
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function topTitles(titles: Map<string, number>, n = 5): string {
  return [...titles.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t)
    .join('|')
}

async function initDatabase(): Promise<ReturnType<typeof createClient>> {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = createClient({ url: `file:${DB_PATH}` })
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
  for (const stmt of schema.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.execute(stmt)
  }
  await db.execute('DELETE FROM employer_lca')
  await db.execute('DELETE FROM employer_alias')
  return db
}

async function loadAggregates(
  db: ReturnType<typeof createClient>,
  allRows: Map<string, AggregateRow>,
): Promise<number> {
  let count = 0
  for (const row of allRows.values()) {
    if (row.certified + row.denied + row.withdrawn < 1) continue
    await db.execute({
      sql: `INSERT OR REPLACE INTO employer_lca
        (employer_norm, employer_display, fiscal_year, certified, denied, withdrawn, median_wage, top_titles)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row.employerNorm,
        row.employerDisplay,
        row.fiscalYear,
        row.certified,
        row.denied,
        row.withdrawn,
        median(row.wages),
        topTitles(row.titles),
      ],
    })
    count++
  }
  return count
}

async function seedAliases(db: ReturnType<typeof createClient>): Promise<void> {
  for (const group of EMPLOYER_ALIAS_GROUPS) {
    const canonical = normalizeEmployer(group[0])
    for (const alias of group.slice(1)) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO employer_alias (alias_norm, canonical_norm, source) VALUES (?, ?, ?)',
        args: [normalizeEmployer(alias), canonical, 'manual'],
      })
    }
  }
}

async function seedFromFallbackJson(db: ReturnType<typeof createClient>): Promise<number> {
  if (!fs.existsSync(FALLBACK_JSON)) return 0
  const data = JSON.parse(fs.readFileSync(FALLBACK_JSON, 'utf-8')) as Record<
    string,
    Record<string, number>
  >
  let count = 0
  for (const [employer, fyMap] of Object.entries(data)) {
    const norm = normalizeEmployer(employer)
    for (const [fy, certified] of Object.entries(fyMap)) {
      if (certified <= 0) continue
      await db.execute({
        sql: `INSERT OR REPLACE INTO employer_lca
          (employer_norm, employer_display, fiscal_year, certified, denied, withdrawn, median_wage, top_titles)
          VALUES (?, ?, ?, ?, 0, 0, NULL, NULL)`,
        args: [norm, employer, fy, certified],
      })
      count++
    }
  }
  return count
}

async function main(): Promise<void> {
  const { local, seedOnly, quarters } = parseArgs()
  console.log('VisaFit LCA pipeline starting…')

  const db = await initDatabase()
  const allAggregates = new Map<string, AggregateRow>()

  if (seedOnly) {
    const seeded = await seedFromFallbackJson(db)
    console.log(`Seeded ${seeded} rows from fallback JSON`)
  } else {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    const files: string[] = []

    if (local) {
      files.push(...fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.xlsx')).map((f) => path.join(CACHE_DIR, f)))
    } else {
      for (const { year, quarter } of quarters) {
        const filename = `LCA_Disclosure_Data_FY${year}_Q${quarter}.xlsx`
        const dest = path.join(CACHE_DIR, filename)
        const url = DOL_URL_TEMPLATE.replace('{year}', String(year)).replace('{quarter}', String(quarter))
        const ok = await downloadFile(url, dest)
        if (ok) files.push(dest)
      }
    }

    if (files.length === 0) {
      console.warn('No XLSX files available — falling back to data/lca.json seed')
      await seedFromFallbackJson(db)
    } else {
      for (const file of files) {
        console.log(`Parsing ${path.basename(file)}…`)
        const parsed = parseWorkbook(file)
        for (const [key, row] of parsed) {
          const existing = allAggregates.get(key)
          if (!existing) {
            allAggregates.set(key, { ...row, wages: [...row.wages], titles: new Map(row.titles) })
          } else {
            existing.certified += row.certified
            existing.denied += row.denied
            existing.withdrawn += row.withdrawn
            existing.wages.push(...row.wages)
            for (const [t, c] of row.titles) {
              existing.titles.set(t, (existing.titles.get(t) ?? 0) + c)
            }
          }
        }
      }
      const loaded = await loadAggregates(db, allAggregates)
      console.log(`Loaded ${loaded} employer×FY rows into ${DB_PATH}`)
    }
  }

  await seedAliases(db)
  const employerCount = await db.execute('SELECT COUNT(DISTINCT employer_norm) as c FROM employer_lca')
  console.log(`Done. ${employerCount.rows[0].c} unique employers in database.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
