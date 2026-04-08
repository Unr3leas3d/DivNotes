const chromeWebStoreUrl = 'https://divnotes.com'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <span className="font-serif text-[17px] tracking-[-0.3px] text-foreground">
          Canopy
        </span>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <a href="#/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </a>
          <a
            href={chromeWebStoreUrl}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Chrome Web Store
          </a>
          <a
            href="mailto:support@divnotes.com"
            className="transition-colors hover:text-foreground"
          >
            support@divnotes.com
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Canopy
        </p>
      </div>
    </footer>
  )
}
