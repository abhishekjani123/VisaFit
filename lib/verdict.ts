import type { AnalyzeRequest, LLMOutput, SignalColor, VerdictResult } from './types'
import { regexPrepass } from './regex-prepass'
import { lookupLCA } from './lca'
import { buildAnalysisPrompt } from './prompts'

function deriveVerdict(visa: SignalColor, ghost: SignalColor, recommended: string): SignalColor {
    if (ghost === 'red') return 'red'
    if (visa === 'red') return 'red'
    if (visa === 'yellow' || ghost === 'yellow') return 'yellow'
    if (recommended === 'neither') return 'yellow'
    return 'green'
}

export async function runVerdict(req: AnalyzeRequest): Promise<VerdictResult> {
    // Step 1: regex pre-pass
    const { ghostFlags: regexFlags, mentionsSponsorship } = regexPrepass(req.jd)

    // Step 2: build prompt
    const prompt = buildAnalysisPrompt(req.jd, req.resumeA, req.resumeB, regexFlags)

    // Step 3: call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 800,
            temperature: 0.1,
        }),
    })

    const data = await response.json()

    let llmResult: LLMOutput
    try {
        llmResult = JSON.parse(data.choices[0].message.content) as LLMOutput
    } catch {
        throw new Error('LLM returned invalid JSON')
    }

    // Step 4: LCA lookup
    const lca = lookupLCA(llmResult.company)

    // Step 5: merge ghost flags
    const allGhostFlags = [...new Set([...regexFlags, ...llmResult.ghostFlags])]

    // Step 6: derive verdict
    const visaSignal: SignalColor = mentionsSponsorship ? 'green' : lca.signal
    const verdict = deriveVerdict(visaSignal, llmResult.ghostRisk, llmResult.recommended)

    // Step 7: round one question
    const roundOneQuestion =
        visaSignal === 'yellow'
            ? 'Before we go further — can you confirm this role offers H-1B sponsorship for the 2026 cycle?'
            : null

    // Step 8: return result
    return {
        company: llmResult.company,
        visaSignal,
        visaTrend: lca.trend,
        visaTrendReason: lca.reason,
        lcaYears: lca.filings,
        ghostRisk: llmResult.ghostRisk,
        ghostFlags: allGhostFlags,
        resumeA: llmResult.resumeA,
        resumeB: llmResult.resumeB,
        recommended: llmResult.recommended,
        verdict,
        reason: llmResult.reason,
        roundOneQuestion,
    }
}
