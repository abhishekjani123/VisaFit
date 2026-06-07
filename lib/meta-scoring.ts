import type { JobMeta } from './types'

export interface MetaScoreResult {
  ghostScore: number
  staffingScore: number
  signals: string[]
}

export function scoreJobMeta(meta: JobMeta | null | undefined): MetaScoreResult {
  if (!meta) return { ghostScore: 0, staffingScore: 0, signals: [] }

  let ghostScore = 0
  let staffingScore = 0
  const signals: string[] = []

  if (meta.applicantCount != null) {
    if (meta.applicantCount >= 500) {
      ghostScore += 28
      signals.push(`Over ${meta.applicantCount} applicants`)
    } else if (meta.applicantCount >= 200) {
      ghostScore += 20
      signals.push(`Over ${meta.applicantCount} applicants`)
    } else if (meta.applicantCount >= 100) {
      ghostScore += 12
      signals.push(`${meta.applicantCount}+ applicants`)
    } else if (meta.applicantText) {
      signals.push(meta.applicantText)
    }
  } else if (meta.applicantText) {
    signals.push(meta.applicantText)
  }

  if (meta.reposted) {
    ghostScore += 20
    signals.push(`Reposted${meta.postedAgo ? `: ${meta.postedAgo}` : ''}`)
  } else if (meta.postedAgo) {
    signals.push(`Posted ${meta.postedAgo}`)
  }

  if (meta.postedDaysAgo != null) {
    if (meta.postedDaysAgo > 60) ghostScore += 25
    else if (meta.postedDaysAgo > 30) ghostScore += 15
  }

  if (!meta.activelyRecruiting && (meta.postedDaysAgo ?? 0) > 14) {
    ghostScore += 10
    signals.push('Not actively recruiting')
  }

  if (meta.employmentType?.toLowerCase().includes('contract')) {
    staffingScore += 15
    signals.push(`Employment type: ${meta.employmentType}`)
  }

  if (meta.jobFunctions.length > 3) {
    ghostScore += 8
    signals.push(`Vague role (${meta.jobFunctions.length} job functions listed)`)
  }

  return {
    ghostScore: Math.min(100, ghostScore),
    staffingScore: Math.min(100, staffingScore),
    signals,
  }
}
