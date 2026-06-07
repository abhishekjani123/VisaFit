const EMBEDDING_MODEL = 'text-embedding-3-small'
const MAX_CHARS = 8000

export interface ResumeEmbedding {
  resumeId: string
  slot: number
  name: string
}

export interface MatchResult {
  resumeId: string
  slot: number
  name: string
  score: number
}

function truncate(text: string): string {
  return text.slice(0, MAX_CHARS)
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncate(text),
    }),
  })

  if (!res.ok) throw new Error(`Embedding failed (${res.status})`)
  const data = await res.json()
  return data.data[0].embedding as number[]
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function computeEmbedding(text: string): Promise<string> {
  const vec = await embed(text)
  return JSON.stringify(vec)
}

export async function matchResumesToJob(
  jd: string,
  resumes: Array<{ id: string; slot: number; name: string; content: string; embedding: string | null }>,
): Promise<MatchResult[]> {
  if (resumes.length === 0) return []

  const jdVec = await embed(jd)
  const results: MatchResult[] = []

  for (const resume of resumes) {
    let resumeVec: number[]
    if (resume.embedding) {
      resumeVec = JSON.parse(resume.embedding) as number[]
    } else {
      resumeVec = await embed(resume.content)
    }

    const sim = cosineSimilarity(jdVec, resumeVec)
    const score = Math.round(Math.max(0, Math.min(100, sim * 100)))
    results.push({ resumeId: resume.id, slot: resume.slot, name: resume.name, score })
  }

  return results.sort((a, b) => b.score - a.score)
}

export function pickBestMatch(matches: MatchResult[]): MatchResult | null {
  return matches[0] ?? null
}
