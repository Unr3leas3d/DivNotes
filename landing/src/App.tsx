import { Chrome, Highlighter, Sparkles, MessageSquare } from "lucide-react";

function App() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
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
          <span className="font-['Georgia',serif] text-[17px] text-[#052415] tracking-[-0.3px]">Canopy</span>
        </div>

      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border/50 text-sm font-medium text-muted-foreground mb-8">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Now available on the Chrome Web Store</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-['Georgia',serif] tracking-tight mb-8">
            Think on top of the web.
          </h1>

          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Select any element on a webpage and create rich notes against it.
            Keep your thoughts organized and visually contextualized.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/25">
              <Chrome className="w-5 h-5" />
              Add to Chrome — It's Free
            </button>

          </div>
        </div>

        {/* Abstract Component Showcase */}
        <div className="max-w-5xl mx-auto mt-24 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />

          <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-2xl relative animate-fade-in group">
            {/* Browser Header Mock */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-secondary/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
              </div>
              <div className="mx-auto bg-background border border-border/50 rounded-md px-3 py-1 text-xs text-muted-foreground flex items-center justify-center w-64 shadow-inner">
                https://example.com
              </div>
            </div>

            {/* App Mock Body */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-70 group-hover:opacity-100 transition-opacity duration-500">
              {/* Simulated Webpage Content */}
              <div className="col-span-2 space-y-4">
                <div className="h-8 bg-secondary/50 rounded-md w-3/4 animate-pulse" />
                <div className="h-4 bg-secondary/30 rounded-md w-full" />
                <div className="h-4 bg-secondary/30 rounded-md w-5/6" />
                <div className="h-4 bg-secondary/30 rounded-md w-full" />

                {/* Selected Element Mock */}
                <div className="mt-8 p-4 border-2 border-primary/50 border-dashed rounded-lg bg-primary/5 relative">
                  <div className="absolute -top-3 -right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg">
                    1
                  </div>
                  <div className="h-32 bg-secondary/50 rounded-md w-full" />
                </div>
              </div>

              {/* Simulated Canopy Side Panel */}
              <div className="col-span-1 border-l border-border/50 pl-6 space-y-4">
                <div className="flex items-center gap-2 mb-6">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Notes on this page</span>
                </div>

                <div className="p-4 rounded-lg bg-secondary/50 border border-border/50 relative">
                  <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg">
                    1
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-3 bg-primary/20 rounded w-1/3" />
                    <div className="h-3 bg-secondary rounded w-1/4" />
                  </div>
                  <div className="h-2 bg-secondary rounded w-full mb-2" />
                  <div className="h-2 bg-secondary rounded w-4/5" />
                </div>

                <div className="p-4 rounded-lg bg-background border border-border/50 border-dashed opacity-50 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Highlighter className="w-3 h-3" />
                    Select element to note
                  </span>
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
