# VisaFit

**Evidence-backed job search for international students — built at the Microsoft GitHub Copilot Hackathon during NYC Tech Week.**

VisaFit helps international students and visa-sponsored job seekers decide **where to spend their limited applications**. Paste a LinkedIn jobs search URL, and VisaFit imports every listing, checks real H-1B employer data, flags ghost jobs and staffing/body-shop posts, matches roles against your resumes, and surfaces **quoted evidence** for every signal — so you apply with proof, not guesswork.

> **🏆 3rd Place** — Microsoft GitHub Copilot MVP Hackathon · NYC Tech Week 2026  
> **📍 Demoed live** at the Microsoft office in New York City

---

## The Problem We Solved

As international students on F-1/OPT, our day-to-day job search looked like this:

- Scroll LinkedIn for hours, unsure which companies actually sponsor H-1B
- Waste applications on **ghost jobs** (reposted listings, hundreds of applicants, no real opening)
- Fall for **staffing agency** and body-shop posts disguised as direct roles
- Tailor resumes blindly without knowing which version fits which job
- Burn credits and energy on roles that were never going to sponsor

We built VisaFit to answer one question before every application: **"Should I burn a credit on this job?"**

---

## Team

- [**Abhishek Jani**](https://github.com/abhishekjani123)
- [**Dipen Prajapati**](https://github.com/Dipen0210)
- [**Janki Kanakia**](https://github.com/Janki10)

Built with heavy use of **GitHub Copilot** throughout the hackathon — from Next.js scaffolding and API routes to regex engines, LLM prompts, and UI components.

---

## Screenshots

### Landing page
<img width="1357" height="833" alt="image" src="https://github.com/user-attachments/assets/164f6ee4-9e0d-458a-b27c-586d97ff9624" />



### LinkedIn job import
Paste your filtered LinkedIn search URL — VisaFit pulls and analyzes every listing automatically.

<img width="742" height="691" alt="image" src="https://github.com/user-attachments/assets/02dc30ee-e821-429b-9e3a-eb9892a66a90" />



### Job tracker with evidence signals
Filter by visa sponsorship, ghost risk, fit score, and recommended action. Every job shows which resume matches best.

<img width="1203" height="834" alt="image" src="https://github.com/user-attachments/assets/f6ddd167-6abe-40dc-a5d0-85f92e19450f" />
<img width="575" height="837" alt="image" src="https://github.com/user-attachments/assets/d85bdb92-1723-4a55-a024-1b98b544066e" />
<img width="577" height="837" alt="image" src="https://github.com/user-attachments/assets/f934b856-7d44-4da0-903e-9b1de13b4e19" />
<img width="577" height="833" alt="image" src="https://github.com/user-attachments/assets/3e5746c0-40cd-4c34-8211-71831db603eb" />


### Resume management (5 slots)
Upload PDF resumes with LLM-powered parsing — skills, experience timeline, links, and projects extracted automatically.

<img width="817" height="509" alt="image" src="https://github.com/user-attachments/assets/12569198-bb79-4482-9729-dbe449f2209f" />


---

## Features

### LinkedIn search import
- Paste any LinkedIn jobs search URL (with your filters already applied)
- Paginates through LinkedIn's public guest API — no browser extension required
- Replaces or refreshes your tracker in one click

### 3-layer H-1B visa evaluation
1. **Employer LCA history** — DOL filing counts, approval rates, wage trends, validation links
2. **Job description LLM analysis** — sponsorship language, work authorization requirements
3. **Combined verdict** — `apply` · `ask recruiter` · `skip` with confidence score

### Ghost job & staffing detection
- **80+ regex rules** with diminishing-returns scoring and quoted evidence
- **LinkedIn metadata** — applicant count, repost age, actively recruiting badge, employment type
- **Single LLM call** per job for visa + ghost + staffing together
- Staffing type badges: Direct · Staffing · Consultancy · Body shop

### Resume intelligence
- **5 named resume slots** — e.g. "Backend", "Full-stack", "ML"
- **LLM resume parsing** (GPT-4o) with regex fallback — works across resume templates
- **Embedding-based fit scoring** — best resume picked per job automatically
- Visual profile preview: experience timeline, skills by category, projects, links

### On-demand generation (1 credit each)
- Tailored cover letters with source attribution
- 3 LinkedIn connection note variants (≤278 chars)

### Evidence-first UI
- Job detail drawer with visa verdict, employer LCA data, JD quotes, regex hits, metadata chips
- No black-box scores — every flag shows the exact text or data that triggered it

---

## Architecture

```
LinkedIn search URL
    │
    ▼
Guest API (seeMoreJobPostings) ──► Job stubs
    │
    ▼
Per-job: fetchJobDetail ──► JD text + metadata (applicants, repost, type)
    │
    ├── regexPrepass (~80 rules)
    ├── evaluateEmployer (LCA DB lookup)
    └── evaluateJobSignals (single GPT-4o call: visa + ghost + staffing)
    │
    ▼
computeGhostStaffing + mergeVerdict ──► JobEvidence JSON
    │
    ▼
Tracker (filter/sort) ──► On-demand: cover letter, LinkedIn notes
```

**Tech stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · libSQL/Turso · OpenAI GPT-4o + embeddings · pdf-parse

---

## Getting Started

### Prerequisites
- Node.js 20+
- OpenAI API key (for LLM features and resume parsing)

### Setup

```bash
git clone https://github.com/abhishekjani123/VisaFit.git
cd VisaFit
npm install
cp .env.local.example .env.local   # add OPENAI_API_KEY
npm run build:lca:seed             # seed employer DB (~instant)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | GPT-4o for job signals, resume parsing, cover letters |
| `TURSO_DATABASE_URL` | No | Cloud DB for production (defaults to local SQLite) |
| `TURSO_AUTH_TOKEN` | No | Turso auth token |
| `SCRAPER_PROXY_URL` | No | HTTP proxy if LinkedIn rate-limits guest API |

### Workflow

1. **Sign up** — 10 free credits on registration
2. **Upload resume** — drop PDF at `/onboarding/resume` or `/resumes`
3. **Import jobs** — paste LinkedIn search URL at `/import`
4. **Track & filter** — sort by fit, visa signal, ghost risk at `/tracker`
5. **Apply with proof** — open any job for full evidence; generate cover letter / notes

---

## Data

### DOL LCA employer database
VisaFit ships with a seeded employer database built from DOL H-1B LCA disclosure data. For full quarterly ingestion:

```bash
npm run build:lca
# Or with local XLSX files:
npm run build:lca -- --local
```

Source: [DOL Foreign Labor Certification](https://www.dol.gov/agencies/eta/foreign-labor/performance)

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run build:lca:seed` | Seed employer DB from fallback data |
| `npm run build:lca` | Full DOL XLSX ingestion |
| `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/eval-visa.ts` | Visa evaluation regression tests |
| `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/eval-ghost.ts` | Ghost/staffing detection tests |
| `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/eval-resume.ts` | Resume parsing tests |

---

## Deploy (Vercel)

1. Push to GitHub and import in Vercel
2. Set `OPENAI_API_KEY` in environment variables
3. Optional: Turso database (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`)
4. Run `npm run build:lca:seed` locally and include `data/visafit.db`, or run ingestion in CI

---

## Hackathon Context

This project was submitted to the **Microsoft GitHub Copilot Event** as part of **NYC Tech Week 2026**. The challenge: *build a tool for your day-to-day life that solves a real problem you face*.

Our team placed **3rd** and demoed VisaFit live at the **Microsoft office in NYC**, walking judges through a real LinkedIn import → tracker → evidence drawer flow for an international student's job search.

GitHub Copilot was used extensively during the 48-hour build:
- Scaffolding the Next.js app, API routes, and database schema
- Writing the regex pre-pass engine and visa evaluation pipeline
- Building UI components (tracker, job drawer, resume profile card)
- Iterating on LLM prompts for combined job signal extraction

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [U.S. Department of Labor](https://www.dol.gov/agencies/eta/foreign-labor) — H-1B LCA disclosure data
- Microsoft & GitHub — Copilot Hackathon, NYC Tech Week 2026
- NYC Tech Week community
