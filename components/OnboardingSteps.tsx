interface Props {
  currentStep: 1 | 2 | 3
}

const STEPS = [
  { num: 1, label: 'Create account' },
  { num: 2, label: 'Upload resume' },
  { num: 3, label: 'Import jobs' },
]

export default function OnboardingSteps({ currentStep }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
      {STEPS.map((step, i) => (
        <div key={step.num} className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                step.num < currentStep
                  ? 'bg-emerald-500 text-white'
                  : step.num === currentStep
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-slate-200 text-slate-400'
              }`}
            >
              {step.num < currentStep ? '✓' : step.num}
            </div>
            <span
              className={`hidden sm:block text-sm font-medium ${
                step.num === currentStep ? 'text-blue-600' : step.num < currentStep ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-8 sm:w-12 ${step.num < currentStep ? 'bg-emerald-300' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
