const STRIP_SUFFIXES = [
  'company',
  'corporation',
  'corp.',
  'corp',
  'incorporated',
  'inc.',
  'inc',
  'llc.',
  'llc',
  'ltd.',
  'ltd',
  'co.',
  'co',
  'lp',
  'llp',
  'plc',
  'usa',
  'us',
  'america',
  'technologies',
  'technology',
  'solutions',
  'services',
  'consulting',
  'group',
  'international',
  'global',
]

export function normalizeEmployer(name: string): string {
  let n = name
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?'"()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let changed = true
  while (changed) {
    changed = false
    for (const suffix of STRIP_SUFFIXES) {
      if (n.endsWith(` ${suffix}`)) {
        n = n.slice(0, -(suffix.length + 1)).trimEnd()
        changed = true
      }
    }
  }

  return n
}

/** Known employer alias groups for canonical resolution */
export const EMPLOYER_ALIAS_GROUPS: string[][] = [
  ['google', 'google llc', 'alphabet', 'alphabet inc'],
  ['microsoft', 'microsoft corporation', 'microsoft corp'],
  ['amazon', 'amazon com services', 'amazon web services', 'aws'],
  ['meta', 'meta platforms', 'facebook', 'facebook inc'],
  ['apple', 'apple inc'],
  ['netflix', 'netflix inc'],
  ['stripe', 'stripe inc'],
  ['intel', 'intel corporation'],
  ['nvidia', 'nvidia corporation'],
  ['salesforce', 'salesforce com'],
  ['oracle', 'oracle america'],
  ['ibm', 'international business machines'],
  ['accenture', 'accenture llp', 'accenture plc'],
  ['deloitte', 'deloitte consulting'],
  ['cognizant', 'cognizant technology solutions'],
  ['infosys', 'infosys limited', 'infosys bpo'],
  ['tata consultancy services', 'tcs', 'tata consultancy'],
  ['wipro', 'wipro limited'],
  ['hcl', 'hcl america', 'hcl technologies'],
  ['capgemini', 'capgemini america'],
]

export function canonicalFromAlias(norm: string): string | null {
  for (const group of EMPLOYER_ALIAS_GROUPS) {
    const normalizedGroup = group.map(normalizeEmployer)
    if (normalizedGroup.includes(norm)) {
      return normalizedGroup[0]
    }
  }
  return null
}
