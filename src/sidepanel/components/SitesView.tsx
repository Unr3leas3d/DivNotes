import React, { useState, useMemo } from 'react';
import {
  Globe,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Search,
} from 'lucide-react';
import type { StoredNote, StoredFolder, StoredTag } from '@/lib/types';
import { NoteCard } from './NoteCard';
import { PinnedSection } from './PinnedSection';

interface GroupedDomain {
  domain: string;
  pages: {
    url: string;
    title: string;
    notes: StoredNote[];
  }[];
}

interface SitesViewProps {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
  searchQuery: string;
  onDeleteNote: (noteId: string) => void;
  onNavigateNote: (note: StoredNote) => void;
}

export function SitesView({
  notes,
  folders,
  tags,
  searchQuery,
  onDeleteNote,
  onNavigateNote,
}: SitesViewProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(() => {
    return new Set(notes.map(n => n.hostname));
  });
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Keep expanded domains in sync when notes change
  React.useEffect(() => {
    setExpandedDomains(prev => {
      const allDomains = new Set(notes.map(n => n.hostname));
      // Add any new domains that weren't previously tracked
      const next = new Set(prev);
      allDomains.forEach(d => next.add(d));
      return next;
    });
  }, [notes]);

  const pinnedNotes = useMemo(() => notes.filter(n => n.pinned), [notes]);

  // Group notes by domain -> page
  const groupedDomains: GroupedDomain[] = useMemo(() => {
    const domainMap = new Map<string, Map<string, StoredNote[]>>();

    notes.forEach(note => {
      if (!domainMap.has(note.hostname)) {
        domainMap.set(note.hostname, new Map());
      }
      const pageMap = domainMap.get(note.hostname)!;
      if (!pageMap.has(note.url)) {
        pageMap.set(note.url, []);
      }
      pageMap.get(note.url)!.push(note);
    });

    return Array.from(domainMap.entries()).map(([domain, pageMap]) => ({
      domain,
      pages: Array.from(pageMap.entries()).map(([url, pageNotes]) => ({
        url,
        title: pageNotes[0]?.pageTitle || domain,
        notes: pageNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      })),
    })).sort((a, b) => a.domain.localeCompare(b.domain));
  }, [notes]);

  // Filter by search
  const filteredDomains = useMemo(() => {
    if (!searchQuery) return groupedDomains;
    const q = searchQuery.toLowerCase();
    return groupedDomains
      .map(d => ({
        ...d,
        pages: d.pages
          .map(p => ({
            ...p,
            notes: p.notes.filter(n =>
              n.content.toLowerCase().includes(q) ||
              n.elementInfo.toLowerCase().includes(q) ||
              n.pageTitle.toLowerCase().includes(q)
            ),
          }))
          .filter(p => p.notes.length > 0),
      }))
      .filter(d => d.pages.length > 0 || d.domain.includes(q));
  }, [groupedDomains, searchQuery]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  return (
    <div className="px-3 py-3">
      {/* Pinned Section */}
      <PinnedSection
        pinnedNotes={pinnedNotes}
        tags={tags}
        onNoteClick={onNavigateNote}
        onDeleteNote={onDeleteNote}
      />

      {/* Empty state: no notes at all */}
      {notes.length === 0 && (
        <div className="text-center py-16">
          <StickyNote className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notes yet</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            Click the Canopy icon &rarr; Select Element to start
          </p>
        </div>
      )}

      {/* Empty state: no search results */}
      {filteredDomains.length === 0 && notes.length > 0 && (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notes match "{searchQuery}"</p>
        </div>
      )}

      {/* Domain > Page > Notes tree */}
      {filteredDomains.map(({ domain, pages }) => (
        <div key={domain} className="mb-2">
          {/* Domain Header */}
          <button
            onClick={() => toggleDomain(domain)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
          >
            {expandedDomains.has(domain) ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium flex-1 truncate">{domain}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {pages.reduce((s, p) => s + p.notes.length, 0)}
            </span>
          </button>

          {/* Pages & Notes */}
          {expandedDomains.has(domain) && (
            <div className="ml-4 pl-3 border-l border-border/30">
              {pages.map((page) => (
                <div key={page.url} className="mb-1">
                  <div className="flex items-center gap-2 px-3 py-1.5 group">
                    <FileText className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {page.title}
                    </span>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <ExternalLink className="w-3 h-3 text-muted-foreground/40 hover:text-muted-foreground" />
                    </a>
                  </div>

                  <div className="space-y-1.5 px-2 pb-2">
                    {page.notes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        tags={tags}
                        onDelete={onDeleteNote}
                        onNavigate={onNavigateNote}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
