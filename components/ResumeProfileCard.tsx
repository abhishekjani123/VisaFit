'use client'

import type { ReactNode } from 'react'
import type { ResumeProfile } from '@/lib/resume-profile'

const LINK_ICONS: Record<string, string> = {
  linkedin: 'in',
  github: 'GH',
  portfolio: '↗',
  email: '@',
  other: '🔗',
}

const LINK_COLORS: Record<string, string> = {
  linkedin: 'bg-[#0A66C2] text-white hover:bg-[#004182]',
  github: 'bg-slate-800 text-white hover:bg-slate-900',
  portfolio: 'bg-violet-600 text-white hover:bg-violet-700',
  email: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  other: 'bg-slate-100 text-slate-700',
}

const ROLE_TYPE_LABEL: Record<string, string> = {
  fulltime: 'Full-time',
  intern: 'Internship',
  contract: 'Contract',
}

const ROLE_TYPE_STYLE: Record<string, string> = {
  fulltime: 'bg-blue-100 text-blue-800',
  intern: 'bg-violet-100 text-violet-800',
  contract: 'bg-amber-100 text-amber-800',
}

interface Props {
  profile: ResumeProfile
  filename?: string
  compact?: boolean
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2 mb-3">
      {children}
    </h3>
  )
}

export default function ResumeProfileCard({ profile, filename, compact }: Props) {
  const webLinks = profile.links.filter((l) => l.type !== 'email')
  const sortedExperiences = [...profile.experiences].sort((a, b) => {
    const da = a.period.match(/\d{4}/)?.[0] ?? '0'
    const db = b.period.match(/\d{4}/)?.[0] ?? '0'
    return db.localeCompare(da)
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header band */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-2xl font-bold tracking-tight truncate">
              {profile.name ?? 'Your Resume'}
            </h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-300">
              {profile.location && <span>{profile.location}</span>}
              {profile.email && <span>{profile.email}</span>}
              {profile.phone && <span>{profile.phone}</span>}
            </div>
            {filename && (
              <p className="text-xs text-emerald-400 font-medium pt-1">✓ {filename}</p>
            )}
          </div>

          {profile.experienceBreakdown && (
            <div className="shrink-0 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
                <p className="text-lg font-bold">{profile.experienceBreakdown.fullTimeLabel}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-300">Full-time</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
                <p className="text-lg font-bold">{profile.experienceBreakdown.internLabel}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-300">Intern</p>
              </div>
              <div className="rounded-xl bg-blue-500/30 ring-1 ring-blue-400/40 px-3 py-2">
                <p className="text-lg font-bold">{profile.experienceBreakdown.totalLabel}</p>
                <p className="text-[10px] uppercase tracking-wide text-blue-200">Total</p>
              </div>
            </div>
          )}
        </div>

        {webLinks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {webLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${LINK_COLORS[link.type]}`}
              >
                <span className="font-bold">{LINK_ICONS[link.type]}</span>
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Experience timeline */}
        {sortedExperiences.length > 0 && (
          <section>
            <SectionTitle>Experience</SectionTitle>
            <div className="space-y-4">
              {sortedExperiences.map((exp, i) => (
                <div key={`${exp.company}-${exp.period}-${i}`} className="relative pl-4 border-l-2 border-blue-200">
                  <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{exp.title}</p>
                      {exp.company && (
                        <p className="text-sm text-slate-600">{exp.company}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ROLE_TYPE_STYLE[exp.type]}`}>
                        {ROLE_TYPE_LABEL[exp.type]}
                      </span>
                      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        {exp.period}
                        {exp.months > 0 && <span className="text-slate-400"> · {exp.months} mo</span>}
                      </span>
                    </div>
                  </div>
                  {!compact && exp.highlights.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {exp.highlights.map((h) => (
                        <li key={h} className="text-sm text-slate-600 flex gap-2">
                          <span className="text-blue-400 shrink-0">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {sortedExperiences.length === 0 && profile.experienceLabel && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Could not parse work history from this PDF layout. Re-upload or try a simpler format.
          </p>
        )}

        {/* Education */}
        {!compact && profile.education.length > 0 && (
          <section>
            <SectionTitle>Education</SectionTitle>
            <div className="space-y-3">
              {profile.education.map((edu, i) => (
                <div key={`${edu.school}-${i}`} className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{edu.school}</p>
                    <p className="text-sm text-slate-600">{edu.degree}</p>
                  </div>
                  {(edu.period || edu.year) && (
                    <p className="text-xs font-medium text-slate-500">{edu.period || edu.year}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {profile.skillGroups.length > 0 ? (
          <section>
            <SectionTitle>Skills</SectionTitle>
            <div className="space-y-3">
              {profile.skillGroups.map((group) => (
                <div key={group.category}>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">{group.category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : profile.skills.length > 0 ? (
          <section>
            <SectionTitle>Skills</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* Projects */}
        {!compact && profile.projects.length > 0 && (
          <section>
            <SectionTitle>Projects</SectionTitle>
            <div className="space-y-3">
              {profile.projects.map((project) => (
                <div key={project.name}>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-slate-900">{project.name}</p>
                    {project.link && (
                      <a
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        GitHub
                      </a>
                    )}
                  </div>
                  {project.highlights.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {project.highlights.map((h) => (
                        <li key={h} className="text-sm text-slate-600 flex gap-2">
                          <span className="text-violet-400 shrink-0">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
