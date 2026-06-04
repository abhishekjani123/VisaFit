export function buildAnalysisPrompt(
    jd: string,
    resumeA: string,
    resumeB: string,
    prepassFlags: string[],
): string {
    const instructions = `You are a job application analyst. Return ONLY valid JSON — no prose, no markdown fences, no explanation. Any non-JSON output will break the parser.

Output schema:
{
  "company": string,
  "ghostRisk": "green" | "yellow" | "red",
  "ghostFlags": string[],
  "resumeA": { "score": number, "pros": string[], "gaps": string[] },
  "resumeB": { "score": number, "pros": string[], "gaps": string[] },
  "recommended": "A" | "B" | "neither",
  "reason": string
}

Field rules:
- company: employer name extracted from the JD
- ghostRisk:
    red: staffing firm repost, no real open role, or JD explicitly says no sponsorship / must be citizen / must be GC / must be authorized
    yellow: vague description, likely copy-paste, missing team/product/manager context, or very generic requirements
    green: specific role, named product or team, real company context, concrete requirements
- ghostFlags: specific reasons justifying the ghostRisk rating (empty array if green and no flags)
- resumeA.score: 0-100 based on skill match, experience level match, and title match to the JD.
  Experience weighting: full-time experience counts 100%, internship experience counts 60%, personal/side projects count 30% of equivalent professional experience.
  Apply this weighting before computing the score — a project that matches a required skill should not be treated the same as a job where that skill was used professionally.
- resumeA.pros: up to 2 specific strengths from this resume that match JD requirements (cite actual skills, titles, or experiences from the resume — not generic praise)
- resumeA.gaps: up to 3 specific missing skills or experiences (not generic advice)
- resumeB.score: 0-100 by the same criteria and experience weighting; if resumeB is empty, set score to 0
- resumeB.pros: up to 2 specific strengths; if resumeB is empty, set to []
- resumeB.gaps: up to 3 gaps; if resumeB is empty, set to []
- recommended: if resumeB is empty, always "A"; otherwise whichever resume scores higher; "neither" only if ghostRisk is red
- reason: 1-2 sentences explaining WHY the recommended resume is a stronger fit — name the specific skills, experiences, or titles from that resume that align with the JD requirements. Do not just say "scores higher"; cite the actual evidence. If neither is recommended, explain the key blocker instead.

Pre-detected flags (factor these in): ${JSON.stringify(prepassFlags)}

--- JOB DESCRIPTION ---
${jd}
--- RESUME A ---
${resumeA}
--- RESUME B ---
${resumeB}`

    return instructions
}
