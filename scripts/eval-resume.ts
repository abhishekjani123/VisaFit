/**
 * Resume parsing regression tests (regex + LLM normalize).
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/eval-resume.ts
 */

import { buildResumeProfile } from '../lib/resume-profile'
import { normalizeLLMProfile, type ResumeLLMOutput } from '../lib/resume-llm'

const ABHISHEK_TEXT = `ABHISHEK VASANTKUMAR JANI
New Brunswick, NJ | +1-201-892-9305 | abhishekjani075@gmail.com | [LinkedIn](https://linkedin.com/in/abhishekjani) | [Github](https://github.com/abhishekjani) | [My Portfolio](https://abhishekjani.dev)

EDUCATION
Rutgers University
Sep 2024 - May 2026
Master of Science, Computer Science (GPA: 3.83 out of 4)

Ganpat University
Jul 2019 - May 2023
Bachelor of Technology, Computer Engineering

SKILLS
Programming Languages: Python, C++, Java, Javascript, TypeScript
Web & Frameworks: Node.js, Express, React, Next.js

EXPERIENCE
Attention Group LLC | Software Engineering Intern
Jun 2025 - Dec 2025
• Built Node.js/Express backend with MongoDB
• Implemented OAuth 2.0 authentication

Sophos | Technical Support Engineer - L1
Aug 2023 - May 2024
• Supported network security modules

Ganpat University | Research Intern
Jan 2023 - May 2023
• Improved image classification accuracy

PROJECTS
Data Reliability Guardrails
• Built validation system

HONORS & ACTIVITIES
Amazon | Selected Participant, Amazon ML Summer School
Jul 2022`

const ABHISHEK_LLM: ResumeLLMOutput = {
  name: 'Abhishek Vasantkumar Jani',
  location: 'New Brunswick, NJ',
  email: 'abhishekjani075@gmail.com',
  phone: '+1-201-892-9305',
  links: [
    { url: 'https://linkedin.com/in/abhishekjani', label: 'LinkedIn', type: 'linkedin' },
    { url: 'https://github.com/abhishekjani', label: 'GitHub', type: 'github' },
    { url: 'https://abhishekjani.dev', label: 'Portfolio', type: 'portfolio' },
  ],
  skillGroups: [
    { category: 'Programming Languages', skills: ['Python', 'C++', 'Java', 'Javascript', 'TypeScript'] },
    { category: 'Web & Frameworks', skills: ['Node.js', 'Express', 'React', 'Next.js'] },
  ],
  experiences: [
    {
      company: 'Attention Group LLC',
      title: 'Software Engineering Intern',
      startISO: '2025-06',
      endISO: '2025-12',
      employmentType: 'intern',
      highlights: ['Built Node.js/Express backend with MongoDB', 'Implemented OAuth 2.0 authentication'],
    },
    {
      company: 'Sophos',
      title: 'Technical Support Engineer - L1',
      startISO: '2023-08',
      endISO: '2024-05',
      employmentType: 'fulltime',
      highlights: ['Supported network security modules'],
    },
    {
      company: 'Ganpat University',
      title: 'Research Intern',
      startISO: '2023-01',
      endISO: '2023-05',
      employmentType: 'intern',
      highlights: ['Improved image classification accuracy'],
    },
  ],
  education: [
    { school: 'Rutgers University', degree: 'Master of Science, Computer Science', startISO: '2024-09', endISO: '2026-05' },
    { school: 'Ganpat University', degree: 'Bachelor of Technology, Computer Engineering', startISO: '2019-07', endISO: '2023-05' },
  ],
  projects: [{ name: 'Data Reliability Guardrails', highlights: ['Built validation system'], link: null }],
}

/** Two-column style: title on one line, company on next, dates on right */
const TWO_COLUMN_TEXT = `JANE DOE
jane@example.com

EXPERIENCE
Software Engineer
Acme Corp
2022-03 - present
Built APIs and led migrations

Backend Intern
StartupXYZ
2021-06 - 2021-12
Shipped payment integration

EDUCATION
MIT
2018 - 2022
BS Computer Science`

const TWO_COLUMN_LLM: ResumeLLMOutput = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  experiences: [
    {
      company: 'Acme Corp',
      title: 'Software Engineer',
      startISO: '2022-03',
      endISO: 'present',
      employmentType: 'fulltime',
      highlights: ['Built APIs and led migrations'],
    },
    {
      company: 'StartupXYZ',
      title: 'Backend Intern',
      startISO: '2021-06',
      endISO: '2021-12',
      employmentType: 'intern',
      highlights: ['Shipped payment integration'],
    },
  ],
  education: [{ school: 'MIT', degree: 'BS Computer Science', startISO: '2018-09', endISO: '2022-05' }],
  skillGroups: [{ category: 'Skills', skills: ['Python'] }],
}

/** Present role with year-only dates */
const PRESENT_ROLE_LLM: ResumeLLMOutput = {
  name: 'Alex Kim',
  experiences: [
    {
      company: 'BigCo',
      title: 'Senior Developer',
      startISO: '2020-01',
      endISO: 'present',
      employmentType: 'fulltime',
      highlights: ['Led team of 5'],
    },
  ],
  education: [{ school: 'State University', degree: 'BS CS', startISO: '2016-09', endISO: '2020-05' }],
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg)
}

function runRegexTests() {
  console.log('=== Regex fallback tests ===\n')
  const p = buildResumeProfile(ABHISHEK_TEXT)
  assert(p.experiences.length === 3, `expected 3 roles, got ${p.experiences.length}`)
  assert((p.totalMonthsExperience ?? 0) >= 20 && (p.totalMonthsExperience ?? 0) <= 26, `expected ~22 mo, got ${p.totalMonthsExperience}`)
  assert(p.links.some((l) => l.type === 'linkedin'), 'missing LinkedIn')
  console.log('  PASS Abhishek regex parse\n')
}

function runNormalizeTests() {
  console.log('=== normalizeLLMProfile tests ===\n')
  let failed = 0

  const cases: Array<{ name: string; text: string; llm: ResumeLLMOutput; check: (p: ReturnType<typeof normalizeLLMProfile>) => void }> = [
    {
      name: 'Abhishek LLM (real resume shape)',
      text: ABHISHEK_TEXT,
      llm: ABHISHEK_LLM,
      check: (p) => {
        assert(p.experiences.length === 3, `roles: ${p.experiences.length}`)
        assert((p.totalMonthsExperience ?? 0) >= 20 && (p.totalMonthsExperience ?? 0) <= 26, `months: ${p.totalMonthsExperience}`)
        assert(p.experienceBreakdown?.internRoles === 2, `intern roles: ${p.experienceBreakdown?.internRoles}`)
        assert(p.experienceBreakdown?.fullTimeRoles === 1, `ft roles: ${p.experienceBreakdown?.fullTimeRoles}`)
        assert(p.links.some((l) => l.type === 'linkedin'), 'missing linkedin')
        assert(p.links.some((l) => l.type === 'github'), 'missing github')
        assert(p.links.some((l) => l.type === 'portfolio'), 'missing portfolio')
        assert(p.education.length === 2, `education: ${p.education.length}`)
        assert(p.skillGroups.length >= 2, 'skill groups')
        assert(p.experiences[0].period.includes('Jun 2025'), `period: ${p.experiences[0].period}`)
        assert(!p.experiences.some((e) => /amazon|summer school/i.test(`${e.company} ${e.title}`)), 'honors in jobs')
      },
    },
    {
      name: 'Two-column / no-pipe template',
      text: TWO_COLUMN_TEXT,
      llm: TWO_COLUMN_LLM,
      check: (p) => {
        assert(p.experiences.length === 2, `roles: ${p.experiences.length}`)
        assert(p.experiences.some((e) => e.period.toLowerCase().includes('present')), 'present role')
        assert((p.experienceBreakdown?.internMonths ?? 0) > 0, 'intern months')
        assert((p.experienceBreakdown?.fullTimeMonths ?? 0) > 0, 'fulltime months')
      },
    },
    {
      name: 'Present role month math',
      text: 'Alex Kim resume',
      llm: PRESENT_ROLE_LLM,
      check: (p) => {
        assert(p.experiences.length === 1, 'one role')
        assert((p.experiences[0].months ?? 0) >= 60, `present role months too low: ${p.experiences[0].months}`)
        assert(p.experiences[0].type === 'fulltime', 'fulltime type')
      },
    },
  ]

  for (const c of cases) {
    try {
      const p = normalizeLLMProfile(c.text, c.llm)
      c.check(p)
      console.log(`  PASS ${c.name}`)
    } catch (e) {
      console.log(`  FAIL ${c.name}: ${e instanceof Error ? e.message : e}`)
      failed++
    }
  }

  try {
    normalizeLLMProfile('empty', { experiences: [], education: [] })
    console.log('  FAIL empty profile should throw')
    failed++
  } catch {
    console.log('  PASS empty profile throws')
  }

  console.log(`\n=== normalize: ${failed === 0 ? 'all passed' : `${failed} failed`} ===\n`)
  if (failed > 0) process.exit(1)
}

runRegexTests()
runNormalizeTests()
