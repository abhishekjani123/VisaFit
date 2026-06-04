export function regexPrepass(jd: string): {
    ghostFlags: string[]
    mentionsSponsorship: boolean
} {
    const normalized = jd.toLowerCase()
    const ghostFlags: string[] = []

    // Staffing signals
    const staffingSignals = [
        'body shop',
        'corp-to-corp',
        'c2c',
        'on w2',
        'right to represent',
        'no h1b',
        'no sponsorship',
        'must be gc',
        'must be usc',
        'must be citizen',
        'must be authorized',
        'tata consultancy',
        'infosys bpo',
        'wipro',
        'hcl technologies',
        'cognizant staffing',
    ]

    // Ghost job signals
    const ghostSignals = [
        'pipeline role',
        'talent pool',
        'future opportunities',
        'building a bench',
        'evergreen requisition',
    ]

    // Check for staffing signals
    for (const signal of staffingSignals) {
        if (normalized.includes(signal)) {
            ghostFlags.push(`Staffing indicator: "${signal}"`)
        }
    }

    // Check for ghost job signals
    for (const signal of ghostSignals) {
        if (normalized.includes(signal)) {
            ghostFlags.push(`Ghost signal: "${signal}"`)
        }
    }

    // Check for sponsorship mentions
    const sponsorshipKeywords = [
        'h-1b',
        'h1b',
        'sponsorship available',
        'will sponsor',
        'visa support',
        'visa sponsorship',
    ]

    const mentionsSponsorship = sponsorshipKeywords.some((keyword) =>
        normalized.includes(keyword),
    )

    return {
        ghostFlags,
        mentionsSponsorship,
    }
}
