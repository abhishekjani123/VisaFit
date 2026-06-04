import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const STRIP_SUFFIXES = ['company', 'corp.', 'corp', 'inc.', 'inc', 'llc.', 'llc', 'ltd.', 'ltd', 'co.']

function normalizeEmployer(name: string): string {
    let n = name.toLowerCase().trim().replace(/[.,;:!?]+$/, '')
    for (const suffix of STRIP_SUFFIXES) {
        if (n.endsWith(' ' + suffix)) {
            n = n.slice(0, -(suffix.length + 1)).trimEnd()
        }
    }
    return n
}

const inputPath = path.resolve(__dirname, 'input/lca_raw.xlsx')
const outputPath = path.resolve(__dirname, '../data/lca.json')

const workbook = XLSX.readFile(inputPath)
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

const aggregate: Record<string, Record<string, number>> = {}

for (const row of rows) {
    if (row['CASE_STATUS'] !== 'Certified') continue
    if (row['VISA_CLASS'] !== 'H-1B') continue

    const employer = row['EMPLOYER_NAME']
    const fy = row['FISCAL_YEAR']
    if (!employer || !fy) continue

    const key = normalizeEmployer(employer)
    if (!aggregate[key]) aggregate[key] = {}
    aggregate[key][fy] = (aggregate[key][fy] ?? 0) + 1
}

// Filter: keep only companies with total filings >= 3
const filtered: Record<string, Record<string, number>> = {}
for (const [company, fyMap] of Object.entries(aggregate)) {
    const total = Object.values(fyMap).reduce((sum, n) => sum + n, 0)
    if (total >= 3) filtered[company] = fyMap
}

fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2))
console.log(`Wrote ${Object.keys(filtered).length} companies to data/lca.json`)
