import type { AnalyzeRequest, LLMOutput, SignalColor, VerdictResult } from './types'
import { regexPrepass, prepassToGhostRisk } from './regex-prepass'
import { lookupLCA } from './lca'
import { buildAnalysisPrompt } from './prompts'

function deriveVerdict(
  visa: SignalColor,
  ghost: SignalColor,
  recommended: string,
  deniesSponsorship: boolean,
): SignalColor {
  if (deniesSponsorship || ghost === 'red') return 'red'
  if (visa === 'red') return 'red'
  if (visa === 'yellow' || ghost === 'yellow') return 'yellow'
  if (recommended === 'neither') return 'yellow'
  return 'green'
}

function mergeGhostRisk(llmRisk: SignalColor, prepassRisk: SignalColor): SignalColor {
  const order: Record<SignalColor, number> = { red: 3, yellow: 2, green: 1 }
  return order[llmRisk] >= order[prepassRisk] ? llmRisk : prepassRisk
}

export async function runVerdict(req: AnalyzeRequest): Promise<VerdictResult> {
  const prepass = regexPrepass(req.jd)
  const prepassGhostRisk = prepassToGhostRisk(prepass)

  const prompt = buildAnalysisPrompt(req.jd, req.resumeA, req.resumeB, prepass)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${errText.slice(0, 200)}`)
  }

  const data = await response.json()

  let llmResult: LLMOutput
  try {
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty LLM response')
    llmResult = JSON.parse(content) as LLMOutput
  } catch {
    throw new Error('LLM returned invalid JSON')
  }

  const lca = await lookupLCA(llmResult.company)
  const allGhostFlags = [...new Set([...prepass.ghostFlags, ...prepass.staffingFlags, ...llmResult.ghostFlags])]
  const ghostRisk = mergeGhostRisk(llmResult.ghostRisk, prepassGhostRisk)

  let visaSignal: SignalColor = lca.signal
  if (prepass.deniesSponsorship) visaSignal = 'red'
  else if (prepass.mentionsSponsorship) visaSignal = 'green'

  const verdict = deriveVerdict(visaSignal, ghostRisk, llmResult.recommended, prepass.deniesSponsorship)

  const roundOneQuestion =
    visaSignal === 'yellow'
      ? 'Before we go further — can you confirm this role offers H-1B sponsorship for the 2026 cycle?'
      : prepass.deniesSponsorship
        ? 'I noticed the posting may not offer visa sponsorship — can you confirm whether H-1B sponsorship is available for this role?'
        : null

  return {
    company: llmResult.company,
    visaSignal,
    visaTrend: lca.trend,
    visaTrendReason: lca.reason,
    lcaYears: lca.filings,
    medianWage: lca.medianWage,
    topTitles: lca.topTitles,
    approvalRate: lca.approvalRate,
    lcaCaveat: lca.caveat,
    matchType: lca.matchType,
    ghostRisk,
    ghostFlags: allGhostFlags,
    ghostScore: prepass.ghostScore,
    staffingScore: prepass.staffingScore,
    resumeA: llmResult.resumeA,
    resumeB: llmResult.resumeB,
    recommended: llmResult.recommended,
    verdict,
    reason: llmResult.reason,
    roundOneQuestion,
  }
}
