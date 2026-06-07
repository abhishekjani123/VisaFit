/**
 * Regression tests for ghost & staffing detection (regex + metadata + blend).
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/eval-ghost.ts
 */

import { regexPrepass, inferStaffingTypeFromHits } from '../lib/regex-prepass'
import { scoreJobMeta } from '../lib/meta-scoring'
import { computeGhostStaffing } from '../lib/visa-evaluator'
import { EMPTY_JOB_META } from '../lib/linkedin'
import type {
  GhostStaffingLLMOutput,
  JobMeta,
  SignalColor,
  StaffingLLMOutput,
  StaffingType,
} from '../lib/types'

interface GhostFixture {
  name: string
  jd: string
  meta?: Partial<JobMeta>
  ghostLlm: GhostStaffingLLMOutput
  staffingLlm: StaffingLLMOutput
  expectStaffingType: StaffingType
  expectStaffingSignal: SignalColor
  expectGhostSignal: SignalColor
  expectEvidence: boolean
}

function mockGhost(
  isGhost: boolean,
  ghostScore: number,
  signal: SignalColor,
  quotes: string[] = [],
): GhostStaffingLLMOutput {
  return {
    isGhost,
    ghostScore,
    signal,
    evidenceQuotes: quotes,
    reasoning: `Test ghost fixture (${signal})`,
    confidence: 75,
  }
}

function mockStaffing(
  isStaffing: boolean,
  type: StaffingType,
  staffingScore: number,
  signal: SignalColor,
  quotes: string[] = [],
): StaffingLLMOutput {
  return {
    isStaffing,
    type,
    staffingScore,
    signal,
    evidenceQuotes: quotes,
    reasoning: `Test staffing fixture (${type})`,
    confidence: 75,
  }
}

const FIXTURES: GhostFixture[] = [
  {
    name: 'body shop — placement program language',
    jd: 'We will market your profile to our clients. H-1B transfer available. Training and placement program for qualified consultants.',
    ghostLlm: mockGhost(false, 15, 'green'),
    staffingLlm: mockStaffing(true, 'body_shop', 90, 'red', [
      'We will market your profile to our clients',
      'Training and placement program',
    ]),
    expectStaffingType: 'body_shop',
    expectStaffingSignal: 'red',
    expectGhostSignal: 'green',
    expectEvidence: true,
  },
  {
    name: 'consultancy — IT consulting + C2C/W2',
    jd: 'Leading IT consulting firm seeking engineers. Multiple positions available. C2C/W2 only, must have own LLC.',
    ghostLlm: mockGhost(false, 10, 'green'),
    staffingLlm: mockStaffing(true, 'consultancy', 75, 'red', ['Leading IT consulting firm']),
    expectStaffingType: 'consultancy',
    expectStaffingSignal: 'red',
    expectGhostSignal: 'green',
    expectEvidence: true,
  },
  {
    name: 'ghost JD + high applicant metadata',
    jd: 'We are building our talent pipeline for future opportunities. No immediate opening at this time.',
    meta: {
      applicantCount: 500,
      applicantText: 'Over 500 applicants',
      reposted: true,
      postedAgo: 'Reposted 3 weeks ago',
      postedDaysAgo: 21,
      activelyRecruiting: false,
      employmentType: 'Full-time',
      seniority: null,
      jobFunctions: [],
      industries: [],
    },
    ghostLlm: mockGhost(true, 85, 'red', ['No immediate opening at this time']),
    staffingLlm: mockStaffing(false, 'direct', 10, 'green'),
    expectStaffingType: 'direct',
    expectStaffingSignal: 'green',
    expectGhostSignal: 'red',
    expectEvidence: true,
  },
  {
    name: 'legit direct hire — salary + no C2C',
    jd: 'Full-time employee role with equity and 401(k). No C2C or third-party agencies. Salary $150k-$180k. Join our team on a mission to build great products.',
    ghostLlm: mockGhost(false, 5, 'green'),
    staffingLlm: mockStaffing(false, 'direct', 5, 'green'),
    expectStaffingType: 'direct',
    expectStaffingSignal: 'green',
    expectGhostSignal: 'green',
    expectEvidence: false,
  },
  {
    name: 'metadata-only ghost — clean JD, reposted + 400 applicants',
    jd: 'Join us as a Senior Software Engineer. You will design and ship features for our platform.',
    meta: {
      applicantCount: 400,
      applicantText: 'Over 400 applicants',
      reposted: true,
      postedAgo: 'Reposted 4 weeks ago',
      postedDaysAgo: 28,
      activelyRecruiting: false,
      employmentType: 'Full-time',
      seniority: 'Mid-Senior level',
      jobFunctions: ['Engineering'],
      industries: ['Software'],
    },
    ghostLlm: mockGhost(true, 70, 'red'),
    staffingLlm: mockStaffing(false, 'direct', 5, 'green'),
    expectStaffingType: 'direct',
    expectStaffingSignal: 'green',
    expectGhostSignal: 'yellow',
    expectEvidence: false,
  },
]

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function runRegexSmokeTests() {
  console.log('=== Regex prepass smoke tests ===\n')
  const bodyShop = regexPrepass(
    'We will market your profile. Training and placement. H-1B transfer.',
  )
  assert(bodyShop.staffingScore >= 50, `body shop staffing score expected >= 50, got ${bodyShop.staffingScore}`)
  assert(inferStaffingTypeFromHits(bodyShop.hits) === 'body_shop', 'expected body_shop from hits')

  const legit = regexPrepass(
    'Direct hire, full-time employee, no C2C or agencies. Salary $150k-$180k. Equity and 401(k).',
  )
  assert(legit.ghostScore < 30, `legit ghost score expected < 30, got ${legit.ghostScore}`)
  assert(legit.legitFlags.length > 0, 'expected legit flags')

  const ghost = regexPrepass('Building our talent pipeline. No immediate opening. Evergreen role.')
  assert(ghost.ghostScore >= 50, `ghost JD score expected >= 50, got ${ghost.ghostScore}`)
  assert(ghost.hits.some((h) => h.matchedText.length > 0), 'expected matched text on hits')

  console.log('  PASS regex smoke (4 checks)\n')
}

function runMetaTests() {
  console.log('=== Metadata scoring tests ===\n')
  const meta: JobMeta = {
    ...EMPTY_JOB_META,
    applicantCount: 400,
    applicantText: 'Over 400 applicants',
    reposted: true,
    postedAgo: 'Reposted 4 weeks ago',
    postedDaysAgo: 28,
    activelyRecruiting: false,
  }
  const scored = scoreJobMeta(meta)
  assert(scored.ghostScore >= 40, `meta ghost score expected >= 40, got ${scored.ghostScore}`)
  assert(scored.signals.length >= 2, 'expected multiple meta signals')
  console.log('  PASS metadata scoring\n')
}

function runBlendFixtures() {
  console.log('=== Blended ghost/staffing fixtures ===\n')
  let passed = 0
  let failed = 0

  for (const fixture of FIXTURES) {
    const prepass = regexPrepass(fixture.jd)
    const meta: JobMeta = { ...EMPTY_JOB_META, ...fixture.meta }
    const result = computeGhostStaffing(
      prepass,
      meta,
      fixture.ghostLlm,
      fixture.staffingLlm,
    )

    const errors: string[] = []
    if (result.staffingType !== fixture.expectStaffingType) {
      errors.push(`staffingType: expected ${fixture.expectStaffingType}, got ${result.staffingType}`)
    }
    if (result.staffingSignal !== fixture.expectStaffingSignal) {
      errors.push(`staffingSignal: expected ${fixture.expectStaffingSignal}, got ${result.staffingSignal}`)
    }
    if (result.ghostSignal !== fixture.expectGhostSignal) {
      errors.push(`ghostSignal: expected ${fixture.expectGhostSignal}, got ${result.ghostSignal}`)
    }
    if (fixture.expectEvidence && result.evidenceQuotes.length === 0 && result.regexHits.length === 0) {
      errors.push('expected evidence quotes or regex hits for positive case')
    }
    if (fixture.meta && result.metaSignals.length === 0) {
      errors.push('expected metaSignals when meta provided')
    }

    if (errors.length === 0) {
      console.log(`  PASS ${fixture.name}`)
      console.log(
        `       ghost=${result.ghostSignal}(${result.ghostScore}) staffing=${result.staffingSignal}(${result.staffingScore}) type=${result.staffingType}`,
      )
      passed++
    } else {
      console.log(`  FAIL ${fixture.name}`)
      errors.forEach((e) => console.log(`       ${e}`))
      failed++
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

runRegexSmokeTests()
runMetaTests()
runBlendFixtures()
