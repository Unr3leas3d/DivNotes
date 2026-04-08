import { useState } from 'react'

type BillingCycle = 'monthly' | 'yearly'

const FREE_FEATURES = [
  'Unlimited local notes',
  'Folders & tags',
  'Element inspector',
  'Side panel workspace',
  'Export & import',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Cloud sync across devices',
  'Automatic backup',
  'Offline fallback & sync queue',
  'Priority support',
]

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>('yearly')
  const proPrice = cycle === 'yearly' ? '$8.33' : '$10'
  const billingNote = cycle === 'yearly' ? 'Billed $100/year' : null

  return (
    <section id="pricing" className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Pricing
            </p>
            <h2
              className="text-3xl font-serif tracking-tight text-foreground"
              style={{ letterSpacing: '-0.8px' }}
            >
              Simple, transparent pricing.
            </h2>
          </div>
          <div className="flex rounded-[12px] border border-border bg-secondary p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`rounded-[10px] px-5 py-2 transition-all ${
                cycle === 'monthly'
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-muted-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle('yearly')}
              className={`rounded-[10px] px-5 py-2 transition-all ${
                cycle === 'yearly'
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-muted-foreground'
              }`}
            >
              Yearly{' '}
              <span
                className={
                  cycle === 'yearly' ? 'text-accent' : 'text-muted-foreground'
                }
              >
                -17%
              </span>
            </button>
          </div>
        </div>

        <div className="mx-auto grid max-w-[680px] grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-[18px] border border-border bg-card p-7">
            <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Free
            </p>
            <div className="mb-1 flex items-baseline gap-1">
              <span className="font-serif text-[42px] font-bold text-foreground">$0</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <p className="mb-6 mt-2 text-sm leading-relaxed text-muted-foreground">
              Everything you need to annotate the web, stored locally in your browser.
            </p>
            <ul className="mb-7 space-y-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[6px] bg-secondary text-ring">
                    <CheckIcon />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href="https://divnotes.com"
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-[12px] border border-border bg-transparent py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Add to Chrome — Free
            </a>
          </div>

          <div className="relative rounded-[18px] bg-primary p-7 text-primary-foreground shadow-elevated">
            <div className="absolute right-4 top-4 rounded-[8px] bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-accent-foreground">
              Popular
            </div>
            <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-primary-foreground/60">
              Pro
            </p>
            <div className="mb-1 flex items-baseline gap-1">
              <span className="font-serif text-[42px] font-bold">{proPrice}</span>
              <span className="text-sm text-primary-foreground/60">/month</span>
            </div>
            {billingNote ? (
              <p className="mt-0.5 text-xs text-primary-foreground/50">{billingNote}</p>
            ) : null}
            <p className="mb-6 mt-2 text-sm leading-relaxed text-primary-foreground/70">
              Sync notes across every device with cloud backup and real-time sync.
            </p>
            <ul className="mb-7 space-y-3">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm">
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[6px] bg-primary-foreground/10 text-accent">
                    <CheckIcon />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href="https://divnotes.com"
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-[12px] bg-accent py-3 text-center text-sm font-bold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Upgrade to Pro
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Install Canopy first, then upgrade from within the extension.
        </p>
      </div>
    </section>
  )
}
