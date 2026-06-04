import lcaData from '../data/lca.json'

const RECENT_FYS = ['FY2025', 'FY2024']

const STRIP_SUFFIXES = ['company', 'corp.', 'corp', 'inc.', 'inc', 'llc.', 'llc', 'ltd.', 'ltd', 'co.']

function normalize(name: string): string {
    let n = name.toLowerCase().trim().replace(/[.,;:!?]+$/, '')
    for (const suffix of STRIP_SUFFIXES) {
        if (n.endsWith(' ' + suffix)) {
            n = n.slice(0, -(suffix.length + 1)).trimEnd()
        }
    }
    return n
}

function findFilings(normalized: string): Record<string, number> | null {
    const data = lcaData as Record<string, Record<string, number>>
    if (data[normalized]) return data[normalized]
    for (const key of Object.keys(data)) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return data[key]
        }
    }
    return null
}

export function lookupLCA(rawCompanyName: string): {
    signal: 'green' | 'yellow' | 'red'
    trend: 'rising' | 'stable' | 'declining' | 'stale' | 'none'
    reason: string
    filings: Record<string, number>
} {
    const normalized = normalize(rawCompanyName)
    const filings = findFilings(normalized)

    if (!filings) {
        return {
            signal: 'red',
            trend: 'none',
            reason: 'No LCA filing history found. Assume no sponsorship without explicit confirmation.',
            filings: {},
        }
    }

    const recentTotal = RECENT_FYS.reduce((sum, fy) => sum + (filings[fy] ?? 0), 0)
    const olderTotal = Object.entries(filings)
        .filter(([fy]) => !RECENT_FYS.includes(fy))
        .reduce((sum, [, v]) => sum + v, 0)

    if (recentTotal >= 5) {
        const sorted = Object.entries(filings)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, v]) => v)
        const delta = sorted[sorted.length - 1] - sorted[0]
        const trend = delta > 5 ? 'rising' : delta < -5 ? 'declining' : 'stable'
        return {
            signal: 'green',
            trend,
            reason: `${recentTotal} certified filings in recent fiscal years. Strong sponsorship signal.`,
            filings,
        }
    }

    if (olderTotal >= 5) {
        return {
            signal: 'yellow',
            trend: 'stale',
            reason: 'Sponsored historically but filings dropped to near-zero in FY2024-25. Confirm before investing interview time.',
            filings,
        }
    }

    return {
        signal: 'red',
        trend: 'none',
        reason: 'No LCA filing history found. Assume no sponsorship without explicit confirmation.',
        filings,
    }
}
