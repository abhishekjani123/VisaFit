function SignalBadge({ signal, label }: { signal: string | null; label?: string }) {
  const cls =
    signal === 'green' ? 'badge-green' : signal === 'yellow' ? 'badge-yellow' : signal === 'red' ? 'badge-red' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label ?? signal ?? '—'}
    </span>
  )
}

export default SignalBadge
