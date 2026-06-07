/**
 * Regression tests for visa evaluation (employer + JD merge).
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/eval-visa.ts
 */

import { regexPrepass } from '../lib/regex-prepass'
import { evaluateEmployer, mergeVerdict } from '../lib/visa-evaluator'
import type { JdVisaEvidence, JdVisaClassification } from '../lib/types'

interface MergeFixture {
  name: string
  company: string
  jd: string
  jdVisa: JdVisaEvidence
  expectedLabelContains: string
  expectedAction: 'apply' | 'ask_recruiter' | 'skip'
  expectedSignal: 'green' | 'yellow' | 'red'
}

function mockJdVisa(
  classification: JdVisaClassification,
  jdSignal: 'green' | 'yellow' | 'red',
  jdScore: number,
): JdVisaEvidence {
  return {
    classification,
    jdSignal,
    jdScore,
    workAuthRequired: [],
    sponsorshipMentioned: classification === 'explicit_yes' || classification === 'likely_yes',
    evidenceQuotes: [],
    reasoning: `Test fixture: ${classification}`,
    confidence: 80,
  }
}

const MERGE_FIXTURES: MergeFixture[] = [
  {
    name: 'explicit_no overrides employer history',
    company: 'Google',
    jd: 'No visa sponsorship available. US work authorization required.',
    jdVisa: mockJdVisa('explicit_no', 'red', 5),
    expectedLabelContains: 'no sponsorship',
    expectedAction: 'skip',
    expectedSignal: 'red',
  },
  {
    name: 'silent JD + unknown employer',
    company: 'Nominal',
    jd: 'Build great software. 5+ years experience required.',
    jdVisa: mockJdVisa('silent', 'yellow', 50),
    expectedLabelContains: 'Unlikely',
    expectedAction: 'skip',
    expectedSignal: 'red',
  },
  {
    name: 'explicit_yes + unknown employer',
    company: 'StartupXYZ',
    jd: 'We offer H-1B visa sponsorship for qualified candidates.',
    jdVisa: mockJdVisa('explicit_yes', 'green', 90),
    expectedLabelContains: 'verify',
    expectedAction: 'ask_recruiter',
    expectedSignal: 'yellow',
  },
  {
    name: 'ambiguous JD',
    company: 'Acme Corp',
    jd: 'Must be authorized to work in the United States.',
    jdVisa: mockJdVisa('ambiguous', 'yellow', 45),
    expectedLabelContains: 'Ask recruiter',
    expectedAction: 'ask_recruiter',
    expectedSignal: 'yellow',
  },
]

async function runMergeTests() {
  console.log('=== Merge verdict tests ===\n')
  let passed = 0
  let failed = 0

  for (const fixture of MERGE_FIXTURES) {
    const employer = await evaluateEmployer(fixture.company)
    const verdict = mergeVerdict(employer, fixture.jdVisa)

    const labelOk = verdict.summaryLabel.toLowerCase().includes(fixture.expectedLabelContains.toLowerCase())
    const actionOk = verdict.recommendedAction === fixture.expectedAction
    const signalOk = verdict.summarySignal === fixture.expectedSignal

    if (labelOk && actionOk && signalOk) {
      console.log(`✓ ${fixture.name}`)
      passed++
    } else {
      console.log(`✗ ${fixture.name}`)
      console.log(`  expected: signal=${fixture.expectedSignal}, action=${fixture.expectedAction}, label~="${fixture.expectedLabelContains}"`)
      console.log(`  got:      signal=${verdict.summarySignal}, action=${verdict.recommendedAction}, label="${verdict.summaryLabel}"`)
      failed++
    }
  }

  return { passed, failed }
}

function runRegexTests() {
  console.log('\n=== Regex prepass tests ===\n')
  let passed = 0
  let failed = 0

  const cases = [
    {
      name: 'detects explicit no sponsorship',
      jd: 'Unable to sponsor H-1B visas for this position.',
      expectDeny: true,
    },
    {
      name: 'detects explicit yes sponsorship',
      jd: 'We provide visa sponsorship including H-1B for exceptional candidates.',
      expectMention: true,
    },
    {
      name: 'silent JD',
      jd: 'Looking for a senior engineer with React experience.',
      expectDeny: false,
      expectMention: false,
    },
  ]

  for (const c of cases) {
    const prepass = regexPrepass(c.jd)
    const denyOk = c.expectDeny === undefined || prepass.deniesSponsorship === c.expectDeny
    const mentionOk = c.expectMention === undefined || prepass.mentionsSponsorship === c.expectMention

    if (denyOk && mentionOk) {
      console.log(`✓ ${c.name}`)
      passed++
    } else {
      console.log(`✗ ${c.name} (deny=${prepass.deniesSponsorship}, mention=${prepass.mentionsSponsorship})`)
      failed++
    }
  }

  return { passed, failed }
}

async function main() {
  const merge = await runMergeTests()
  const regex = runRegexTests()

  const totalPassed = merge.passed + regex.passed
  const totalFailed = merge.failed + regex.failed

  console.log(`\n=== Summary: ${totalPassed} passed, ${totalFailed} failed ===`)
  if (totalFailed > 0) process.exit(1)
}

void main()
