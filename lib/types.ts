export type SignalColor = 'green' | 'yellow' | 'red'

export interface VerdictResult {
    company: string
    visaSignal: SignalColor
    visaTrend: 'rising' | 'stable' | 'declining' | 'stale' | 'none'
    visaTrendReason: string
    lcaYears: Record<string, number>
    ghostRisk: SignalColor
    ghostFlags: string[]
    resumeA: { score: number; pros: string[]; gaps: string[] }
    resumeB: { score: number; pros: string[]; gaps: string[] }
    recommended: 'A' | 'B' | 'neither'
    verdict: SignalColor
    reason: string
    roundOneQuestion: string | null
}

export interface AnalyzeRequest {
    jd: string
    resumeA: string
    resumeB: string
}

export interface LLMOutput {
    company: string
    ghostRisk: SignalColor
    ghostFlags: string[]
    resumeA: { score: number; pros: string[]; gaps: string[] }
    resumeB: { score: number; pros: string[]; gaps: string[] }
    recommended: 'A' | 'B' | 'neither'
    reason: string
}
