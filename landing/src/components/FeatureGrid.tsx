import {
  CloudIcon,
  CursorInWindowIcon,
  DashboardSquare01Icon,
  FileEditIcon,
  Folder01Icon,
  LeftToRightBlockQuoteIcon,
  Tag01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

interface Feature {
  title: string
  description: string
  icon: typeof DashboardSquare01Icon
  screenshot: string
  isNew?: boolean
}

const features: Feature[] = [
  {
    title: 'Popup Dashboard',
    description:
      'See all notes for the current page. Switch between This Page, All Notes, Folders, Tags.',
    icon: DashboardSquare01Icon,
    screenshot: '/screenshots/popup-dashboard.png',
  },
  {
    title: 'Side Panel',
    description:
      'Full workspace alongside any page. Bulk actions, search, and rich note cards.',
    icon: LeftToRightBlockQuoteIcon,
    screenshot: '/screenshots/side-panel.png',
  },
  {
    title: 'Folders',
    description: 'Color-coded folders. Open any folder as a Chrome tab group.',
    icon: Folder01Icon,
    screenshot: '/screenshots/folders.png',
  },
  {
    title: 'Tags',
    description: 'Tag notes with custom labels. Filter across your entire workspace.',
    icon: Tag01Icon,
    screenshot: '/screenshots/tags.png',
  },
  {
    title: 'Cloud Sync',
    description: 'Sync across devices with offline fallback. Never lose a note.',
    icon: CloudIcon,
    screenshot: '/screenshots/cloud-sync.png',
  },
  {
    title: 'Element Inspector',
    description:
      'Hover to highlight any element. Click to attach a note right there.',
    icon: CursorInWindowIcon,
    screenshot: '/screenshots/element-inspector.png',
  },
  {
    title: 'Obsidian Plugin',
    description:
      'Two-way sync to your Obsidian vault. Notes become markdown files with backlinks and domain indexes.',
    icon: FileEditIcon,
    screenshot: '/screenshots/obsidian-vault.png',
    isNew: true,
  },
]

function FeatureCard({
  feature,
  className,
}: {
  feature: Feature
  className?: string
}) {
  return (
    <div
      className={`relative rounded-[18px] border border-border bg-card p-5 shadow-card ${
        className ?? ''
      }`}
    >
      {feature.isNew ? (
        <div className="absolute right-3 top-3 rounded-[6px] bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-accent-foreground">
          New
        </div>
      ) : null}
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[10px] bg-secondary text-foreground">
        <HugeiconsIcon icon={feature.icon} color="currentColor" strokeWidth={1.8} size={18} />
      </div>
      <h3 className="mb-1 text-[15px] font-bold text-foreground">{feature.title}</h3>
      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
        {feature.description}
      </p>
      <div className="overflow-hidden rounded-[12px] border border-border bg-secondary/50">
        <img
          src={feature.screenshot}
          alt={`${feature.title} screenshot`}
          className="h-auto w-full"
          loading="lazy"
        />
      </div>
    </div>
  )
}

export function FeatureGrid() {
  return (
    <section id="features" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Features
        </p>
        <h2
          className="mb-12 text-3xl font-serif tracking-tight text-foreground"
          style={{ letterSpacing: '-0.8px' }}
        >
          Everything you need to annotate the web.
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
