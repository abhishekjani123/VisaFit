import Link from 'next/link'
import Nav from '@/components/Nav'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 mb-6">
            Built for international students · Evidence-backed job decisions
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Import your LinkedIn search.<br />
            Apply only where it counts.
          </h1>
          <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto">
            Paste a LinkedIn jobs URL. VisaFit pulls every listing, checks real H-1B sponsorship data,
            flags ghost jobs and staffing reposts, and ranks each role against your resumes — with evidence you can verify.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login?mode=register" className="btn-primary px-8 py-3.5">Get started free</Link>
            <Link href="/login" className="btn-secondary px-8 py-3.5">Sign in</Link>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
            <div className="grid sm:grid-cols-4 gap-6">
              {[
                { step: '1', title: 'Create account', desc: 'Sign up free with 10 credits for cover letters and LinkedIn notes.' },
                { step: '2', title: 'Upload resume', desc: 'Drop your PDF — we extract skills, experience, links, and highlights automatically.' },
                { step: '3', title: 'Import & track', desc: 'Paste your LinkedIn search URL. Filter, sort, and apply with evidence.' },
                { step: '4', title: 'Apply with proof', desc: 'Cover letters, LinkedIn notes, and match evidence — all backed by data.' },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold">{s.step}</div>
                  <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4 grid sm:grid-cols-3 gap-6">
            {[
              { title: 'Real H-1B data', desc: 'DOL LCA filing history with validation links — not guesses.', icon: '📊' },
              { title: 'Evidence for everything', desc: 'Every flag shows the exact phrase matched and why.', icon: '🔍' },
              { title: '5 resume versions', desc: 'Each job ranked against all your resumes. Best one picked automatically.', icon: '📄' },
            ].map((f) => (
              <div key={f.title} className="card p-6">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
