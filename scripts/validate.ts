#!/usr/bin/env npx ts-node --compiler-options '{"module":"CommonJS"}'
/**
 * End-to-end validation script for VisaFit.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/validate.ts
 */
import { initDb } from '../lib/db/client'
import { parseSearchUrl, fetchJobStubs } from '../lib/linkedin'
import { createUser, authenticateUser, createSession, upsertResume, getUserResumes, deleteResume } from '../lib/auth'

const LINKEDIN_URL =
  'https://www.linkedin.com/jobs/search-results/?currentJobId=4380624926&showHowYouFit=HOW_YOU_FIT&keywords=Full%20Stack%20Developer&origin=QUALIFICATION_LANDING&originToLandingJobPostings=4380624926%2C4417722841%2C4420477935&geoId=90000070'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

let passed = 0
let failed = 0

function ok(label: string) {
  console.log(`  ✓ ${label}`)
  passed++
}

function fail(label: string, err: unknown) {
  console.log(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`)
  failed++
}

async function testPages() {
  console.log('\n── Pages ──')
  for (const path of ['/', '/login', '/import', '/resumes', '/tracker']) {
    try {
      const res = await fetch(`${BASE}${path}`)
      if (res.status === 200) ok(`${path} → 200`)
      else fail(`${path} → ${res.status}`, await res.text().then((t) => t.slice(0, 80)))
    } catch (e) {
      fail(`${path}`, e)
    }
  }
}

async function testDb() {
  console.log('\n── Database ──')
  try {
    await initDb()
    ok('initDb + migration')
  } catch (e) {
    fail('initDb', e)
  }
}

async function testLinkedInParse() {
  console.log('\n── LinkedIn URL parsing ──')
  try {
    const params = parseSearchUrl(LINKEDIN_URL)
    if (params.keywords === 'Full Stack Developer') ok('keywords parsed')
    else fail('keywords', `got "${params.keywords}"`)
    if (params.geoId === '90000070') ok('geoId parsed')
    else fail('geoId', `got "${params.geoId}"`)
  } catch (e) {
    fail('parseSearchUrl', e)
  }
}

async function testLinkedInFetch() {
  console.log('\n── LinkedIn guest API (1 page) ──')
  try {
    const params = parseSearchUrl(LINKEDIN_URL)
    const stubs = await fetchJobStubs(params, 1)
    if (stubs.length > 0) ok(`fetched ${stubs.length} job stub(s) — e.g. "${stubs[0].title}" at ${stubs[0].company}`)
    else fail('fetchJobStubs', '0 jobs returned (LinkedIn may be rate-limiting)')
  } catch (e) {
    fail('fetchJobStubs', e)
  }
}

async function testAuthAndResumes() {
  console.log('\n── Auth + Resumes API ──')
  const email = `test-${Date.now()}@visafit.dev`
  const password = 'testpass123'

  try {
    const user = await createUser(email, password, 'Test User')
    ok(`createUser (${email})`)

    const authed = await authenticateUser(email, password)
    if (authed.id === user.id) ok('authenticateUser')
    else fail('authenticateUser', 'id mismatch')

    const token = await createSession(user.id)
    ok('createSession')

    const resumeId = await upsertResume(user.id, 1, 'Primary', 'Experienced full-stack developer with React, Node.js, TypeScript.', 'test.pdf')
    ok(`upsertResume (${resumeId})`)

    const resumes = await getUserResumes(user.id)
    if (resumes.length === 1 && resumes[0].slot === 1) ok('getUserResumes')
    else fail('getUserResumes', JSON.stringify(resumes))

    await deleteResume(user.id, 1)
    ok('deleteResume')

    // Test via HTTP with bearer token
    const res = await fetch(`${BASE}/api/resumes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.status === 200 && Array.isArray(data.resumes)) ok('/api/resumes GET → 200')
    else fail('/api/resumes GET', `${res.status} ${JSON.stringify(data)}`)
  } catch (e) {
    fail('auth/resumes flow', e)
  }
}

async function testPublicApis() {
  console.log('\n── Public APIs ──')
  try {
    const auth = await fetch(`${BASE}/api/auth`)
    if (auth.status === 200) ok('/api/auth GET → 200')
    else fail('/api/auth GET', auth.status)

    const jobs = await fetch(`${BASE}/api/jobs`)
    const jobsData = await jobs.json()
    if (jobs.status === 401 && jobsData.error === 'Sign in required') ok('/api/jobs GET → 401 (expected)')
    else fail('/api/jobs GET', `${jobs.status}`)
  } catch (e) {
    fail('public APIs', e)
  }
}

async function main() {
  console.log('VisaFit validation')
  console.log(`Base URL: ${BASE}`)
  console.log(`LinkedIn URL: ${LINKEDIN_URL.slice(0, 60)}…`)

  await testDb()
  await testLinkedInParse()
  await testPages()
  await testPublicApis()
  await testAuthAndResumes()
  await testLinkedInFetch()

  console.log(`\n── Result: ${passed} passed, ${failed} failed ──`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
