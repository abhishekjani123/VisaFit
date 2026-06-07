export function buildRecruiterQuestion(title: string | null, company: string | null): string {
  const role = title ?? 'this role'
  const org = company ?? 'your company'
  return `Hi, I'm interested in the ${role} position at ${org}. Does ${org} sponsor H-1B or OPT for this role?`
}
