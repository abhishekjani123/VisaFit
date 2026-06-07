export type SignalColor = 'green' | 'yellow' | 'red'
export type JobStatus = 'interested' | 'applied' | 'interviewing' | 'rejected' | 'offer'
export type IngestionStatus = 'pending' | 'fetching' | 'analyzing' | 'done' | 'error'

export interface SignalHit {
  label: string
  category: 'staffing' | 'ghost' | 'consultancy' | 'sponsorship_yes' | 'sponsorship_no' | 'legit'
  weight: number
  matchedText: string
}

export interface PrepassResult {
  ghostFlags: string[]
  staffingFlags: string[]
  consultancyFlags: string[]
  legitFlags: string[]
  mentionsSponsorship: boolean
  deniesSponsorship: boolean
  ghostScore: number
  staffingScore: number
  consultancyScore: number
  legitReduction: number
  sponsorshipScore: number
  hits: SignalHit[]
}

export interface JobMeta {
  applicantCount: number | null
  applicantText: string | null
  postedAgo: string | null
  reposted: boolean
  postedDaysAgo: number | null
  activelyRecruiting: boolean
  employmentType: string | null
  seniority: string | null
  jobFunctions: string[]
  industries: string[]
}

export type StaffingType = 'direct' | 'staffing' | 'consultancy' | 'body_shop'

export interface GhostStaffingEvidence {
  ghostSignal: SignalColor
  ghostScore: number
  staffingSignal: SignalColor
  staffingScore: number
  staffingType: StaffingType
  isLikelyGhost: boolean
  isLikelyStaffing: boolean
  confidence: number
  evidenceQuotes: string[]
  metaSignals: string[]
  regexHits: SignalHit[]
  reasoning: string
  llmFallback?: boolean
}

export interface GhostStaffingLLMOutput {
  isGhost: boolean
  ghostScore: number
  signal: SignalColor
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
}

export interface StaffingLLMOutput {
  isStaffing: boolean
  type: StaffingType
  staffingScore: number
  signal: SignalColor
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
}

export interface JobSignalsLLMOutput {
  visa: JdVisaLLMOutput
  ghost: GhostStaffingLLMOutput
  staffing: StaffingLLMOutput
}

export interface ValidationLink {
  label: string
  url: string
}

export interface LCAEvidence {
  signal: SignalColor
  trend: 'rising' | 'stable' | 'declining' | 'stale' | 'none'
  reason: string
  filings: Record<string, number>
  medianWage: number | null
  topTitles: string[]
  approvalRate: number | null
  matchType: string
  caveat: string
  validationLinks: ValidationLink[]
}

export type JdVisaClassification =
  | 'explicit_yes'
  | 'likely_yes'
  | 'silent'
  | 'ambiguous'
  | 'likely_no'
  | 'explicit_no'

export type VisaRecommendedAction = 'apply' | 'ask_recruiter' | 'skip'

export type MatchConfidence = 'exact' | 'alias' | 'fuzzy' | 'fallback' | 'none'

export interface EmployerVisaEvidence {
  employerSignal: SignalColor
  employerScore: number
  recentFilings: number
  trend: 'rising' | 'stable' | 'declining' | 'stale' | 'none'
  approvalRate: number | null
  matchConfidence: MatchConfidence
  employerSummary: string
  filings: Record<string, number>
  medianWage: number | null
  topTitles: string[]
  caveat: string
  validationLinks: ValidationLink[]
  displayName: string
}

export interface JdVisaEvidence {
  classification: JdVisaClassification
  jdSignal: SignalColor
  jdScore: number
  workAuthRequired: string[]
  sponsorshipMentioned: boolean
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
  llmFallback?: boolean
}

export interface VisaVerdict {
  summarySignal: SignalColor
  summaryLabel: string
  confidence: number
  recommendedAction: VisaRecommendedAction
  conflictNote: string | null
  headline: string
}

export interface JdVisaLLMOutput {
  classification: JdVisaClassification
  jdSignal: SignalColor
  jdScore: number
  workAuthRequired: string[]
  sponsorshipMentioned: boolean
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
}

export interface ResumeMatchEvidence {
  resumeId: string
  slot: number
  name: string
  score: number
}

export interface JobEvidence {
  prepass: PrepassResult
  employer: EmployerVisaEvidence
  jdVisa: JdVisaEvidence
  verdict: VisaVerdict
  ghostStaffing: GhostStaffingEvidence
  meta?: JobMeta
  /** @deprecated Legacy field — use employer + verdict */
  lca?: LCAEvidence
  resumeMatches: ResumeMatchEvidence[]
  bestResume: ResumeMatchEvidence | null
  overallVerdict: SignalColor
}

export interface TrackerJob {
  id: string
  ingestionId: string | null
  linkedinJobId: string | null
  title: string | null
  company: string | null
  location: string | null
  postedDate: string | null
  url: string | null
  jdText: string | null
  visaSignal: SignalColor | null
  visaSummary: string | null
  visaConfidence: number | null
  ghostRisk: SignalColor | null
  ghostScore: number
  staffingScore: number
  bestResumeId: string | null
  bestResumeName: string | null
  fitScore: number
  evidence: JobEvidence | null
  status: JobStatus
  appliedAt: string | null
  createdAt: string
}

export interface Ingestion {
  id: string
  url: string
  paramsJson: string
  total: number
  analyzed: number
  status: IngestionStatus
  error: string | null
  createdAt: string
}

export interface User {
  id: string
  email: string
  name: string | null
  credits: number
}

export interface ResumeSlot {
  id: string
  slot: number
  name: string
  content: string
  filename: string | null
  updatedAt: string
}

export interface VerdictResult {
  company: string
  visaSignal: SignalColor
  visaTrend: 'rising' | 'stable' | 'declining' | 'stale' | 'none'
  visaTrendReason: string
  lcaYears: Record<string, number>
  medianWage: number | null
  topTitles: string[]
  approvalRate: number | null
  lcaCaveat: string
  matchType: string
  ghostRisk: SignalColor
  ghostFlags: string[]
  ghostScore: number
  staffingScore: number
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

export interface DeepEvidenceResult {
  matchedPoints: string[]
  gaps: string[]
  reasoning: string
}

export interface CoverLetterResult {
  letter: string
  usedFromResume: string[]
  usedFromJd: string[]
}

export type NoteCategory = 'hiring_manager' | 'founder' | 'peer'

export interface LinkedInNoteResult {
  category: NoteCategory
  note: string
  charCount: number
  usedFromResume: string[]
  usedFromJd: string[]
}
