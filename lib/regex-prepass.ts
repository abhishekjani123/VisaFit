import type { PrepassResult, SignalColor, SignalHit } from './types'

interface SignalRule {
  pattern: RegExp
  weight: number
  label: string
  category: SignalHit['category']
}

const DIMINISHING = [1, 0.7, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15]

const SIGNAL_RULES: SignalRule[] = [
  // Staffing / vendor
  { pattern: /\bbody\s*shop\b/i, weight: 25, label: 'Body shop language', category: 'staffing' },
  { pattern: /\bcorp[\s-]?to[\s-]?corp\b/i, weight: 30, label: 'Corp-to-corp (C2C)', category: 'staffing' },
  { pattern: /(?<!\bno\s)\bc2c\b/i, weight: 25, label: 'C2C contract', category: 'staffing' },
  { pattern: /\bon\s+w2\b/i, weight: 20, label: 'W2-only requirement', category: 'staffing' },
  { pattern: /\bw2\s+only\b/i, weight: 20, label: 'W2 only', category: 'staffing' },
  { pattern: /\bc2h\b|\bcontract[\s-]?to[\s-]?hire\b/i, weight: 15, label: 'Contract-to-hire', category: 'staffing' },
  { pattern: /\bw2\s+or\s+c2c\b/i, weight: 25, label: 'W2 or C2C', category: 'staffing' },
  { pattern: /\bright\s+to\s+represent\b/i, weight: 35, label: 'Right to represent', category: 'staffing' },
  { pattern: /\bbench(?:ing)?\b/i, weight: 30, label: 'Bench/benching language', category: 'staffing' },
  { pattern: /\bstaffing\s+(?:firm|agency|company)\b/i, weight: 25, label: 'Staffing agency', category: 'staffing' },
  { pattern: /\b1099\b/i, weight: 20, label: '1099 contractor', category: 'staffing' },
  { pattern: /\bvendors?\s+only\b/i, weight: 25, label: 'Vendors only', category: 'staffing' },
  { pattern: /\bsubcontractor\b/i, weight: 15, label: 'Subcontractor', category: 'staffing' },
  { pattern: /\bimplementation\s+partner\b/i, weight: 15, label: 'Implementation partner', category: 'staffing' },
  { pattern: /\bcontract(?:or)?\s+role\b/i, weight: 10, label: 'Contract role', category: 'staffing' },
  { pattern: /\bthird[\s-]?party\s+payroll\b/i, weight: 25, label: 'Third-party payroll', category: 'staffing' },
  { pattern: /\bclient\s+location\b/i, weight: 15, label: 'Client location (staffing)', category: 'staffing' },
  { pattern: /\bpass[\s-]?through\b/i, weight: 20, label: 'Pass-through vendor', category: 'staffing' },
  { pattern: /\bmust\s+have\s+own\b.*\b(?:llc|corp)\b/i, weight: 30, label: 'Must have own LLC/corp', category: 'staffing' },
  { pattern: /\bown\s+(?:llc|corporation)\b/i, weight: 25, label: 'Own LLC required', category: 'staffing' },
  { pattern: /\bend\s+client\b/i, weight: 20, label: 'End client language', category: 'staffing' },
  { pattern: /\bprime\s+vendor\b/i, weight: 25, label: 'Prime vendor', category: 'staffing' },
  { pattern: /\blayers?\b.*\bvendor\b/i, weight: 15, label: 'Vendor layers', category: 'staffing' },
  { pattern: /\bhourly\s+(?:rate|w2|c2c)\b/i, weight: 15, label: 'Hourly rate/W2/C2C', category: 'staffing' },
  { pattern: /\bnegotiable\s+rate\b/i, weight: 10, label: 'Negotiable rate', category: 'staffing' },
  { pattern: /\bmarket\s+rate\b/i, weight: 8, label: 'Market rate', category: 'staffing' },
  { pattern: /\brate\s*:\s*\$?\d+\s*[-/]\s*hr\b/i, weight: 15, label: 'Hourly rate listed', category: 'staffing' },
  { pattern: /\bper\s+hour\b.*\bcontract\b/i, weight: 12, label: 'Per hour contract', category: 'staffing' },
  { pattern: /\bstaff\s+augmentation\b/i, weight: 30, label: 'Staff augmentation', category: 'staffing' },
  { pattern: /\bresource\s+augmentation\b/i, weight: 30, label: 'Resource augmentation', category: 'staffing' },
  { pattern: /\bIT\s+services\s+(?:firm|company|provider)\b/i, weight: 15, label: 'IT services firm', category: 'staffing' },
  { pattern: /\bconsultant\s+only\b/i, weight: 20, label: 'Consultant only', category: 'staffing' },
  { pattern: /\bno\s+direct\s+hire\b/i, weight: 25, label: 'No direct hire', category: 'staffing' },
  { pattern: /\bteksystems\b/i, weight: 20, label: 'TEKsystems', category: 'staffing' },
  { pattern: /\brandstad\b/i, weight: 20, label: 'Randstad', category: 'staffing' },
  { pattern: /\brobert\s+half\b/i, weight: 20, label: 'Robert Half', category: 'staffing' },
  { pattern: /\bapex\s+systems\b/i, weight: 20, label: 'Apex Systems', category: 'staffing' },
  { pattern: /\bcollabera\b/i, weight: 20, label: 'Collabera', category: 'staffing' },
  { pattern: /\bcompu\s*vision\b/i, weight: 20, label: 'CompuVision', category: 'staffing' },
  { pattern: /\binsight\s+global\b/i, weight: 20, label: 'Insight Global', category: 'staffing' },
  { pattern: /\bmodis\b/i, weight: 18, label: 'Modis staffing', category: 'staffing' },
  { pattern: /\bkforce\b/i, weight: 18, label: 'Kforce staffing', category: 'staffing' },
  { pattern: /\bcognizant\b/i, weight: 18, label: 'Cognizant', category: 'staffing' },
  { pattern: /\binfosys\b/i, weight: 18, label: 'Infosys', category: 'staffing' },
  { pattern: /\bwipro\b/i, weight: 18, label: 'Wipro', category: 'staffing' },
  { pattern: /\bhcl\b/i, weight: 15, label: 'HCL', category: 'staffing' },
  { pattern: /\btata\s+consultancy\b|\btcs\b/i, weight: 18, label: 'TCS', category: 'staffing' },
  { pattern: /\bcapgemini\b/i, weight: 18, label: 'Capgemini', category: 'staffing' },
  { pattern: /\baccenture\b/i, weight: 10, label: 'Accenture', category: 'staffing' },
  { pattern: /\bdeloitte\b/i, weight: 8, label: 'Deloitte', category: 'staffing' },
  { pattern: /\bmindtree\b/i, weight: 18, label: 'Mindtree', category: 'staffing' },
  { pattern: /\bmphasis\b/i, weight: 18, label: 'Mphasis', category: 'staffing' },
  { pattern: /\bvirtusa\b/i, weight: 18, label: 'Virtusa', category: 'staffing' },
  { pattern: /\bsyntel\b/i, weight: 18, label: 'Syntel', category: 'staffing' },
  { pattern: /\bust\b/i, weight: 15, label: 'UST', category: 'staffing' },
  { pattern: /\bcybertec\b/i, weight: 18, label: 'Cybertec', category: 'staffing' },
  { pattern: /\bdiverse\s+lynx\b/i, weight: 18, label: 'Diverse Lynx', category: 'staffing' },
  { pattern: /\bmastech\b/i, weight: 18, label: 'Mastech', category: 'staffing' },
  { pattern: /\beteam\b/i, weight: 18, label: 'eTeam', category: 'staffing' },
  { pattern: /\bphoton\b/i, weight: 15, label: 'Photon', category: 'staffing' },
  { pattern: /\bsonata\b/i, weight: 15, label: 'Sonata', category: 'staffing' },

  // Consultancy / body-shop
  { pattern: /\bconsulting\s+(?:firm|services|company)\b/i, weight: 15, label: 'Consulting firm', category: 'consultancy' },
  { pattern: /\bsystem\s+integrator\b/i, weight: 20, label: 'System integrator', category: 'consultancy' },
  { pattern: /\bwe\s+place\s+(?:candidates|consultants)\b/i, weight: 30, label: 'We place candidates', category: 'consultancy' },
  { pattern: /\bh[\s-]?1b\s+transfer\b/i, weight: 25, label: 'H-1B transfer', category: 'consultancy' },
  { pattern: /\b(?:opt|cpt)\s+(?:candidates|welcome|friendly)\b/i, weight: 15, label: 'OPT/CPT friendly', category: 'consultancy' },
  { pattern: /\btraining\s+and\s+placement\b/i, weight: 35, label: 'Training and placement', category: 'consultancy' },
  { pattern: /\bplacement\s+(?:program|assistance|guarantee)\b/i, weight: 35, label: 'Placement program', category: 'consultancy' },
  { pattern: /\bmarketing\s+your\s+profile\b/i, weight: 40, label: 'Marketing your profile', category: 'consultancy' },
  { pattern: /\bwe\s+will\s+market\b/i, weight: 40, label: 'We will market profile', category: 'consultancy' },
  { pattern: /\bsubmit\s+your\s+(?:resume|profile)\s+to\s+clients\b/i, weight: 30, label: 'Submit profile to clients', category: 'consultancy' },
  { pattern: /\bproject\s+support\b.*\bremote\b/i, weight: 10, label: 'Remote project support', category: 'consultancy' },
  { pattern: /\bmultiple\s+positions\b/i, weight: 12, label: 'Multiple positions', category: 'consultancy' },
  { pattern: /\bvisa\s+(?:independent|transfer)\b/i, weight: 15, label: 'Visa transfer/independent', category: 'consultancy' },

  // Ghost jobs
  { pattern: /\bpipeline\s+role\b/i, weight: 30, label: 'Pipeline role', category: 'ghost' },
  { pattern: /\btalent\s+pool\b/i, weight: 25, label: 'Talent pool', category: 'ghost' },
  { pattern: /\bfuture\s+opportunities\b/i, weight: 20, label: 'Future opportunities', category: 'ghost' },
  { pattern: /\bbuilding\s+a\s+bench\b/i, weight: 30, label: 'Building a bench', category: 'ghost' },
  { pattern: /\bevergreen\s+requisition\b/i, weight: 35, label: 'Evergreen requisition', category: 'ghost' },
  { pattern: /\bevergreen\b/i, weight: 30, label: 'Evergreen posting', category: 'ghost' },
  { pattern: /\bcontinuous\s+opening\b/i, weight: 25, label: 'Continuous opening', category: 'ghost' },
  { pattern: /\brolling\s+basis\b/i, weight: 15, label: 'Rolling basis', category: 'ghost' },
  { pattern: /\bgeneral\s+application\b/i, weight: 20, label: 'General application', category: 'ghost' },
  { pattern: /\bopen\s+application\b/i, weight: 20, label: 'Open application', category: 'ghost' },
  { pattern: /\bwe(?:'re|\s+are)\s+always\s+hiring\b/i, weight: 25, label: 'Always hiring', category: 'ghost' },
  { pattern: /\balways\s+looking\b/i, weight: 20, label: 'Always looking', category: 'ghost' },
  { pattern: /\bno\s+specific\s+(?:role|position)\b/i, weight: 25, label: 'No specific role', category: 'ghost' },
  { pattern: /\bexploratory\s+(?:call|conversation|role)\b/i, weight: 20, label: 'Exploratory role', category: 'ghost' },
  { pattern: /\bkeep\s+on\s+file\b/i, weight: 20, label: 'Keep on file', category: 'ghost' },
  { pattern: /\bresume\s+database\b/i, weight: 20, label: 'Resume database', category: 'ghost' },
  { pattern: /\bover\s+100\s+applicants\b/i, weight: 15, label: '100+ applicants', category: 'ghost' },
  { pattern: /\breposted\b/i, weight: 15, label: 'Reposted listing', category: 'ghost' },
  { pattern: /\bposition\s+may\s+not\s+be\s+available\b/i, weight: 30, label: 'May not be available', category: 'ghost' },
  { pattern: /\bnot\s+an\s+active\s+opening\b/i, weight: 35, label: 'Not active opening', category: 'ghost' },
  { pattern: /\bongoing\s+(?:need|requirement)\b/i, weight: 20, label: 'Ongoing need', category: 'ghost' },
  { pattern: /\bproactive(?:ly)?\s+(?:sourcing|hiring|recruiting)\b/i, weight: 25, label: 'Proactive sourcing', category: 'ghost' },
  { pattern: /\bbuild(?:ing)?\s+(?:our|a)\s+(?:pipeline|talent\s+community)\b/i, weight: 30, label: 'Building talent pipeline', category: 'ghost' },
  { pattern: /\btalent\s+community\b/i, weight: 25, label: 'Talent community', category: 'ghost' },
  { pattern: /\bexpression\s+of\s+interest\b/i, weight: 20, label: 'Expression of interest', category: 'ghost' },
  { pattern: /\bregister\s+your\s+interest\b/i, weight: 25, label: 'Register your interest', category: 'ghost' },
  { pattern: /\bno\s+immediate\s+(?:opening|vacancy)\b/i, weight: 35, label: 'No immediate opening', category: 'ghost' },
  { pattern: /\bnot\s+a\s+(?:live|current)\s+(?:role|vacancy)\b/i, weight: 35, label: 'Not a live role', category: 'ghost' },
  { pattern: /\bspeculative\s+application\b/i, weight: 30, label: 'Speculative application', category: 'ghost' },
  { pattern: /\bfor\s+future\s+reference\b/i, weight: 20, label: 'For future reference', category: 'ghost' },
  { pattern: /\bmultiple\s+locations\b.*\bvarious\b/i, weight: 10, label: 'Multiple vague locations', category: 'ghost' },
  { pattern: /\banticipated\s+(?:opening|need)\b/i, weight: 25, label: 'Anticipated opening', category: 'ghost' },
  { pattern: /\bwe\s+hire\s+continuously\b/i, weight: 25, label: 'Hire continuously', category: 'ghost' },
  { pattern: /\bpre[\s-]?screen\b.*\bpool\b/i, weight: 20, label: 'Pre-screen pool', category: 'ghost' },

  // No sponsorship
  { pattern: /\bno\s+h[\s-]?1b\b/i, weight: 40, label: 'No H-1B', category: 'sponsorship_no' },
  { pattern: /\bno\s+sponsorship\b/i, weight: 40, label: 'No sponsorship', category: 'sponsorship_no' },
  { pattern: /\bnot\s+sponsor(?:ing|ship)?\b/i, weight: 35, label: 'Will not sponsor', category: 'sponsorship_no' },
  { pattern: /\bunable\s+to\s+sponsor\b/i, weight: 35, label: 'Unable to sponsor', category: 'sponsorship_no' },
  { pattern: /\bmust\s+be\s+(?:a\s+)?(?:us\s+)?citizen\b/i, weight: 35, label: 'US citizen required', category: 'sponsorship_no' },
  { pattern: /\bmust\s+be\s+(?:a\s+)?usc\b/i, weight: 35, label: 'USC required', category: 'sponsorship_no' },
  { pattern: /\bmust\s+be\s+(?:a\s+)?(?:green\s+card|gc)\s+holder\b/i, weight: 30, label: 'GC holder required', category: 'sponsorship_no' },
  { pattern: /\bwithout\s+sponsorship\b/i, weight: 30, label: 'Without sponsorship', category: 'sponsorship_no' },
  { pattern: /\bauthorized\s+to\s+work\s+without\s+sponsorship\b/i, weight: 35, label: 'No sponsorship needed', category: 'sponsorship_no' },
  { pattern: /\bgc\s*[/]?\s*usc\s+only\b/i, weight: 25, label: 'GC/USC only', category: 'sponsorship_no' },

  // Positive sponsorship
  { pattern: /\bh[\s-]?1b\s+sponsorship\b/i, weight: 30, label: 'H-1B sponsorship mentioned', category: 'sponsorship_yes' },
  { pattern: /\bwill\s+sponsor\b/i, weight: 35, label: 'Will sponsor', category: 'sponsorship_yes' },
  { pattern: /\bsponsorship\s+available\b/i, weight: 30, label: 'Sponsorship available', category: 'sponsorship_yes' },
  { pattern: /\bvisa\s+sponsorship\b/i, weight: 30, label: 'Visa sponsorship', category: 'sponsorship_yes' },
  { pattern: /\bopen\s+to\s+sponsor(?:ing|ship)?\b/i, weight: 30, label: 'Open to sponsoring', category: 'sponsorship_yes' },
  { pattern: /\bf[\s-]?1\s+opt\s+(?:to\s+)?h[\s-]?1b\b/i, weight: 25, label: 'OPT to H-1B path', category: 'sponsorship_yes' },

  // Legit / negative signals (reduce ghost/staffing)
  { pattern: /\bdirect\s+hire\b/i, weight: 20, label: 'Direct hire', category: 'legit' },
  { pattern: /\bfull[\s-]?time\s+(?:employee|permanent)\b/i, weight: 10, label: 'Full-time employee', category: 'legit' },
  { pattern: /\bno\s+(?:c2c|third[\s-]party|agencies)\b/i, weight: 25, label: 'No C2C/agencies', category: 'legit' },
  { pattern: /\bequity\b|\bstock\s+options\b|\bRSU\b/i, weight: 10, label: 'Equity/stock options', category: 'legit' },
  { pattern: /\b401\s*\(\s*k\s*\)\b/i, weight: 8, label: '401(k) benefits', category: 'legit' },
  { pattern: /\bour\s+team\b.*\bmission\b/i, weight: 5, label: 'Team mission language', category: 'legit' },
]

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

function extractMatch(text: string, pattern: RegExp): string {
  const m = text.match(pattern)
  return m?.[0] ?? ''
}

function applyDiminishing(hits: SignalHit[]): number {
  const sorted = [...hits].sort((a, b) => b.weight - a.weight)
  let total = 0
  sorted.forEach((hit, i) => {
    total += hit.weight * (DIMINISHING[i] ?? 0.1)
  })
  return total
}

const BODY_SHOP_LABELS = new Set([
  'Marketing your profile', 'We will market profile', 'Training and placement',
  'Placement program', 'Submit profile to clients', 'We place candidates',
])

const CONSULTANCY_LABELS = new Set([
  'Consulting firm', 'System integrator', 'Multiple positions',
])

export function inferStaffingTypeFromHits(hits: SignalHit[]): 'direct' | 'staffing' | 'consultancy' | 'body_shop' {
  for (const h of hits) {
    if (BODY_SHOP_LABELS.has(h.label)) return 'body_shop'
  }
  for (const h of hits) {
    if (h.category === 'consultancy' || CONSULTANCY_LABELS.has(h.label)) return 'consultancy'
  }
  const staffingHits = hits.filter((h) => h.category === 'staffing' || h.category === 'consultancy')
  if (staffingHits.length >= 2) return 'staffing'
  if (staffingHits.length === 1 && staffingHits[0].weight >= 20) return 'staffing'
  return 'direct'
}

export function regexPrepass(jd: string): PrepassResult {
  const rawHits: SignalHit[] = []
  const ghostFlags: string[] = []
  const staffingFlags: string[] = []
  const consultancyFlags: string[] = []
  const legitFlags: string[] = []
  let sponsorshipYesScore = 0
  let sponsorshipNoScore = 0

  for (const rule of SIGNAL_RULES) {
    if (!rule.pattern.test(jd)) continue
    const matchedText = extractMatch(jd, rule.pattern)
    rawHits.push({ label: rule.label, category: rule.category, weight: rule.weight, matchedText })

    switch (rule.category) {
      case 'staffing':
        staffingFlags.push(`${rule.label} (+${rule.weight}): "${matchedText}"`)
        break
      case 'consultancy':
        consultancyFlags.push(`${rule.label} (+${rule.weight}): "${matchedText}"`)
        staffingFlags.push(`${rule.label} (+${rule.weight}): "${matchedText}"`)
        break
      case 'ghost':
        ghostFlags.push(`${rule.label} (+${rule.weight}): "${matchedText}"`)
        break
      case 'sponsorship_yes':
        sponsorshipYesScore += rule.weight
        break
      case 'sponsorship_no':
        sponsorshipNoScore += rule.weight
        ghostFlags.push(`No sponsorship: ${rule.label} (+${rule.weight})`)
        break
      case 'legit':
        legitFlags.push(`${rule.label} (-${rule.weight})`)
        break
    }
  }

  const hasSalary = /\$\s?\d{2,3}[,.]?\d{0,3}\s?(?:k|K|,|\.\d{2})/i.test(jd)
  if (!hasSalary && jd.length > 500) {
    rawHits.push({ label: 'No salary range', category: 'ghost', weight: 15, matchedText: '' })
    ghostFlags.push('No salary range listed (+15)')
  } else if (hasSalary) {
    rawHits.push({ label: 'Salary range listed', category: 'legit', weight: 10, matchedText: '' })
    legitFlags.push('Salary range listed (-10)')
  }

  const ghostHits = rawHits.filter((h) => h.category === 'ghost')
  const staffingHits = rawHits.filter((h) => h.category === 'staffing' || h.category === 'consultancy')
  const legitHits = rawHits.filter((h) => h.category === 'legit')

  let ghostScore = applyDiminishing(ghostHits)
  let staffingScore = applyDiminishing(staffingHits)
  const consultancyScore = applyDiminishing(rawHits.filter((h) => h.category === 'consultancy'))
  const legitReduction = applyDiminishing(legitHits)

  ghostScore = clamp(ghostScore - legitReduction * 0.6)
  staffingScore = clamp(staffingScore - legitReduction * 0.8)

  if (sponsorshipNoScore >= 25) {
    staffingScore = clamp(staffingScore + Math.floor(sponsorshipNoScore / 3))
  }

  return {
    ghostFlags,
    staffingFlags,
    consultancyFlags,
    legitFlags,
    mentionsSponsorship: sponsorshipYesScore >= 25,
    deniesSponsorship: sponsorshipNoScore >= 25,
    ghostScore,
    staffingScore,
    consultancyScore,
    legitReduction,
    sponsorshipScore: clamp(sponsorshipYesScore - sponsorshipNoScore + 50),
    hits: rawHits,
  }
}

export function prepassToGhostRisk(prepass: PrepassResult): SignalColor {
  const combined = clamp(prepass.ghostScore + prepass.staffingScore * 0.5)
  if (combined >= 60) return 'red'
  if (combined >= 30) return 'yellow'
  return 'green'
}

export function scoreToColor(score: number): SignalColor {
  if (score >= 60) return 'red'
  if (score >= 30) return 'yellow'
  return 'green'
}

export function scoreToStaffingSignal(score: number): SignalColor {
  return scoreToColor(score)
}

export function scoreToGhostSignal(score: number): SignalColor {
  return scoreToColor(score)
}
