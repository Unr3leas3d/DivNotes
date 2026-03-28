import { Chrome } from "lucide-react";

function App() {
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
            Organize with folders and tags, sync across devices.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-[10px] font-semibold transition-all hover:opacity-90 shadow-card">
              <Chrome className="w-5 h-5" />
              Add to Chrome — Free
            </button>
            <button className="flex items-center gap-2 bg-card text-foreground px-8 py-4 rounded-[10px] font-semibold border border-border transition-all hover:bg-secondary">
              See How It Works
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
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
              </div>
              <div className="mx-auto bg-background border border-border rounded-md px-3 py-1 text-xs text-muted-foreground flex items-center justify-center w-64">
                github.com/myproject/pulls/42
              </div>
            </div>

            <div id="features" className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2 space-y-4">
                <div className="h-8 bg-secondary rounded-md w-3/4" />
                <div className="h-4 bg-secondary/60 rounded-md w-full" />
                <div className="h-4 bg-secondary/60 rounded-md w-5/6" />
                <div className="h-4 bg-secondary/60 rounded-md w-full" />
                <div className="mt-8 space-y-3">
                  <div className="h-6 bg-secondary rounded-md w-2/3" />
                  <div className="h-4 bg-secondary/60 rounded-md w-full" />
                  <div className="h-4 bg-secondary/60 rounded-md w-4/5" />
                </div>
              </div>

              <div id="how-it-works" className="col-span-1 border-l border-border pl-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-[6px] bg-[#052415] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 68 68" fill="none">
                      <path d="M32 62 C33 52 33 44 33 36" stroke="#F5EFE9" strokeWidth="5" strokeLinecap="round"/>
                      <path d="M33 36 C26 24 14 12 6 6" stroke="#F5EFE9" strokeWidth="4.5" strokeLinecap="round"/>
                      <path d="M33 36 C42 22 54 10 62 6" stroke="#F5EFE9" strokeWidth="4.5" strokeLinecap="round"/>
                      <circle cx="6" cy="6" r="5" fill="#ABFFC0"/>
                      <circle cx="62" cy="6" r="5" fill="#ABFFC0"/>
                    </svg>
                  </div>
                  <span className="font-semibold text-sm text-foreground">Canopy</span>
                  <div className="ml-auto w-5 h-5 rounded-full bg-[#ABFFC0] text-[#052415] text-[10px] font-bold flex items-center justify-center">2</div>
                </div>

                <div className="p-3 rounded-[10px] bg-card border border-border shadow-card">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-[4px]" style={{ background: 'linear-gradient(135deg, #052415, #1a5c2e)' }} />
                    <span className="text-xs font-semibold text-foreground">PR review checklist</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Check merge conflicts...</p>
                </div>
                <div className="p-3 rounded-[10px] bg-card border border-border shadow-card">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-[4px]" style={{ background: 'linear-gradient(135deg, #1a5c2e, #6ead71)' }} />
                    <span className="text-xs font-semibold text-foreground">API response format</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">Returns JSON with cursor...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
