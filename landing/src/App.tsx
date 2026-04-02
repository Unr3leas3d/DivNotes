import { Chrome } from "lucide-react";
import PrivacyPolicy from "./pages/PrivacyPolicy";

function App() {
  if (window.location.hash === '#/privacy') {
    return <PrivacyPolicy />;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[9px] bg-[#052415] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 68 68" fill="none">
                <path d="M32 62 C33 52 33 44 33 36" stroke="#F5EFE9" strokeWidth="4" strokeLinecap="round"/>
                <path d="M33 36 C26 24 14 12 6 6" stroke="#F5EFE9" strokeWidth="3.5" strokeLinecap="round"/>
                <path d="M33 36 C42 22 54 10 62 6" stroke="#F5EFE9" strokeWidth="3.5" strokeLinecap="round"/>
                <path d="M33 36 C44 28 56 20 62 18" stroke="#F5EFE9" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="6" cy="6" r="4.5" fill="#ABFFC0"/>
                <circle cx="62" cy="6" r="4.5" fill="#ABFFC0"/>
                <circle cx="62" cy="18" r="4" fill="#ABFFC0"/>
              </svg>
            </div>
            <span className="font-serif text-[17px] text-foreground tracking-[-0.3px]">Canopy</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <button className="bg-primary text-primary-foreground px-5 py-2.5 rounded-[10px] text-sm font-semibold hover:opacity-90 transition-opacity">
            Add to Chrome
          </button>
        </div>
      </nav>

      <main className="relative z-10 pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-serif tracking-tight mb-8 text-foreground" style={{ letterSpacing: '-1.8px' }}>
            Think on top of the web.
          </h1>

          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Select any element on any webpage and attach notes directly to it.
            Stay local for free, or upgrade to Pro when you want cloud sync across devices.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-[10px] font-semibold transition-all hover:opacity-90 shadow-card">
              <Chrome className="w-5 h-5" />
              Add to Chrome — Free
            </button>
            <button className="flex items-center gap-2 bg-card text-foreground px-8 py-4 rounded-[10px] font-semibold border border-border transition-all hover:bg-secondary">
              Install Canopy to Upgrade
            </button>
          </div>

          <div className="flex items-center justify-center gap-8 md:gap-16 text-center">
            <div>
              <div className="text-2xl font-serif font-bold text-foreground">2,400+</div>
              <div className="text-xs text-muted-foreground mt-1">Active Users</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <div className="text-2xl font-serif font-bold text-foreground">50,000+</div>
              <div className="text-xs text-muted-foreground mt-1">Notes Created</div>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <div className="text-2xl font-serif font-bold text-foreground">4.8</div>
              <div className="text-xs text-muted-foreground mt-1">★ Chrome Web Store</div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-hero animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-[1.2fr,0.8fr] gap-0">
              <div id="features" className="p-8 border-b md:border-b-0 md:border-r border-border">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">How It Works</p>
                <h2 className="text-3xl font-serif text-foreground tracking-tight mb-4">
                  Keep everything local until you actually need sync.
                </h2>
                <p className="text-sm leading-7 text-muted-foreground max-w-xl">
                  Canopy starts with a free local workspace for notes, folders, and tags. When you
                  want synced access across browsers or machines, upgrade to Pro from inside the
                  extension and finish checkout on Polar-hosted billing pages.
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-[16px] border border-border bg-secondary/50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Free</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">Local-only workspace</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Attach notes anywhere on the web, organize with folders and tags, and keep
                      everything saved in this browser.
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-border bg-white p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Pro</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">Cloud sync unlocked</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Use the same notes across devices with Supabase-backed sync and hosted billing
                      handled through Polar.
                    </p>
                  </div>
                </div>
              </div>

              <div id="pricing" className="p-8 bg-secondary/30">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Pricing</p>
                <div className="space-y-4">
                  <div className="rounded-[16px] border border-border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-foreground">Free</span>
                      <span className="text-sm text-muted-foreground">$0</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Local notes, folders, tags, and browser-only storage.
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-[#052415] bg-[#052415] p-4 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">Pro</span>
                      <span className="text-sm text-[#d3e4d7]">Monthly or Yearly</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#d3e4d7]">
                      Unlock cloud sync. Billing, tax handling, invoices, and subscription changes
                      are managed through Polar after you start from the extension.
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-xs leading-5 text-muted-foreground">
                  Install Canopy first, then use the extension settings to choose monthly or yearly Pro.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
