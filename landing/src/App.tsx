import { Chrome } from 'lucide-react'
import { FeatureGrid } from './components/FeatureGrid'
import { Footer } from './components/Footer'
import { PricingSection } from './components/PricingSection'
import { ThemeToggle } from './components/ThemeToggle'
import PrivacyPolicy from './pages/PrivacyPolicy'

const chromeWebStoreUrl = 'https://divnotes.com'

function App() {
  if (window.location.hash === '#/privacy') {
    return <PrivacyPolicy />
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-serif text-[17px] tracking-[-0.3px] text-foreground">
            Canopy
          </span>
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href={chromeWebStoreUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Add to Chrome
            </a>
          </div>
        </div>
      </nav>

      <main className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(171,255,192,0.28),transparent_52%),linear-gradient(180deg,rgba(5,36,21,0.03),transparent)]" />

        <div className="px-6 pb-16 pt-20">
          <div className="mx-auto max-w-4xl text-center animate-fade-in">
            <h1
              className="mb-8 text-5xl font-serif tracking-tight text-foreground md:text-7xl"
              style={{ letterSpacing: '-1.8px' }}
            >
            Think on top of the web.
            </h1>

            <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Select any element on any webpage and attach notes directly to it.
              Stay local for free, or upgrade to Pro when you want cloud sync across devices.
            </p>

            <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href={chromeWebStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-[10px] bg-primary px-8 py-4 font-semibold text-primary-foreground shadow-card transition-all hover:opacity-90"
              >
                <Chrome className="h-5 w-5" />
                Add to Chrome — Free
              </a>
              <a
                href="#features"
                className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-8 py-4 font-semibold text-foreground transition-all hover:bg-secondary"
              >
                See How It Works
              </a>
            </div>

            <div className="flex items-center justify-center gap-8 text-center md:gap-16">
              <div>
                <div className="text-2xl font-serif font-bold text-foreground">2,400+</div>
                <div className="mt-1 text-xs text-muted-foreground">Active Users</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="text-2xl font-serif font-bold text-foreground">50,000+</div>
                <div className="mt-1 text-xs text-muted-foreground">Notes Created</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="text-2xl font-serif font-bold text-foreground">4.8</div>
                <div className="mt-1 text-xs text-muted-foreground">★ Chrome Web Store</div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-hero animate-fade-in">
              <img
                src="/screenshots/element-inspector.png"
                alt="Canopy element inspector overlay on a webpage"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>

        <FeatureGrid />
        <PricingSection />
      </main>

      <Footer />
    </div>
  )
}

export default App
