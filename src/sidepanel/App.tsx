import React, { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { getNotesService, type NotesService } from '@/lib/notes-service';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    StickyNote,
    Search,
    Globe,
    ExternalLink,
    FileText,
    Trash2,
    ChevronDown,
    ChevronRight,
    Download,
} from 'lucide-react';

interface StoredNote {
    id: string;
    url: string;
    hostname: string;
    pageTitle: string;
    elementSelector: string;
    elementTag: string;
    elementInfo: string;
    content: string;
    createdAt: string;
}

interface GroupedDomain {
    domain: string;
    pages: {
        url: string;
        title: string;
        notes: StoredNote[];
    }[];
}

export default function App() {
    const [notes, setNotes] = useState<StoredNote[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
    const [screenShareMode, setScreenShareMode] = useState(false);
    const serviceRef = useRef<NotesService | null>(null);

    // Init notes service
    useEffect(() => {
        getNotesService().then(s => { serviceRef.current = s; });
    }, []);

    // Load notes and screen share state from storage
    useEffect(() => {
        chrome.storage.local.get(['divnotes_notes', 'divnotes_screen_share'], (result) => {
            const allNotes: StoredNote[] = result.divnotes_notes || [];
            setNotes(allNotes);
            setScreenShareMode(!!result.divnotes_screen_share);
            const domains = new Set(allNotes.map(n => n.hostname));
            setExpandedDomains(domains);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.divnotes_notes) {
                const updated: StoredNote[] = changes.divnotes_notes.newValue || [];
                setNotes(updated);
            }
            if (changes.divnotes_screen_share) {
                setScreenShareMode(!!changes.divnotes_screen_share.newValue);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    // Group notes by domain → page
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

    const toggleNote = (noteId: string) => {
        setExpandedNotes(prev => {
            const next = new Set(prev);
            if (next.has(noteId)) next.delete(noteId);
            else next.add(noteId);
            return next;
        });
    };

    const handleDelete = async (noteId: string) => {
        // Delete via service (handles cloud sync if authenticated)
        if (serviceRef.current) {
            await serviceRef.current.delete(noteId);
        } else {
            // Fallback: direct chrome.storage
            chrome.storage.local.get(['divnotes_notes'], (result) => {
                const allNotes: StoredNote[] = result.divnotes_notes || [];
                const updated = allNotes.filter(n => n.id !== noteId);
                chrome.storage.local.set({ divnotes_notes: updated });
            });
        }
    };

    const handleNavigate = (note: StoredNote) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab?.url === note.url && tab?.id) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SCROLL_TO_NOTE',
                    selector: note.elementSelector,
                });
            } else if (tab?.id) {
                chrome.tabs.update(tab.id, { url: note.url });
            }
        });
    };

    const handleExport = () => {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            notes,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `divnotes-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const simpleMarkdown = (text: string): string => {
        try {
            const rawHtml = marked.parse(text, { async: false }) as string;
            return DOMPurify.sanitize(rawHtml, {
                ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'code', 'pre', 'br', 'span', 'div', 'blockquote'],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
            });
        } catch (e) {
            console.error('[DivNotes] Markdown parsing error', e);
            return DOMPurify.sanitize(text); // Fallback to raw sanitized text
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Screen Share Mode Banner */}
            {screenShareMode && (
                <div className="bg-red-500/90 text-white px-4 py-2 text-xs font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Screen Share Mode — notes hidden on page
                    <span className="text-[10px] opacity-70 ml-auto">⌘⇧P to exit</span>
                </div>
            )}
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50">
                <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/90 to-primary/60 flex items-center justify-center shadow-md shadow-primary/20">
                        <StickyNote className="w-4.5 h-4.5 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-base font-semibold">DivNotes</h1>
                        <p className="text-[11px] text-muted-foreground">
                            {notes.length} {notes.length === 1 ? 'note' : 'notes'} across{' '}
                            {new Set(notes.map(n => n.hostname)).size} sites
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={handleExport}
                        disabled={notes.length === 0}
                        title="Export all notes"
                    >
                        <Download className="w-4 h-4" />
                    </Button>
                </div>

                {/* Search */}
                <div className="px-5 pb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-muted/50 border-border/30"
                        />
                    </div>
                </div>
            </div>

            {/* Notes List */}
            <div className="px-3 py-3">
                {notes.length === 0 && (
                    <div className="text-center py-16">
                        <StickyNote className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No notes yet</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-1">
                            Click the DivNotes icon → Select Element to start
                        </p>
                    </div>
                )}

                {filteredDomains.length === 0 && notes.length > 0 && (
                    <div className="text-center py-12">
                        <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No notes match "{searchQuery}"</p>
                    </div>
                )}

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
                                        <div className="flex items-center gap-2 px-3 py-1.5">
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
                                                <Card
                                                    key={note.id}
                                                    className="border-border/30 bg-card/30 hover:bg-card/50 transition-colors overflow-hidden"
                                                >
                                                    <CardContent className="p-0">
                                                        <button
                                                            onClick={() => toggleNote(note.id)}
                                                            className="w-full text-left p-3"
                                                        >
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                                                    &lt;{note.elementTag}&gt;
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground truncate">
                                                                    {note.elementInfo}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-foreground/80 line-clamp-2">
                                                                {note.content.replace(/[*`#\[\]]/g, '').slice(0, 80)}
                                                            </p>
                                                            <span className="text-[10px] text-muted-foreground/40 mt-1 block">
                                                                {new Date(note.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </button>

                                                        {expandedNotes.has(note.id) && (
                                                            <div className="px-3 pb-3">
                                                                <Separator className="mb-3 opacity-30" />
                                                                <div
                                                                    className="text-xs leading-relaxed"
                                                                    dangerouslySetInnerHTML={{
                                                                        __html: simpleMarkdown(note.content),
                                                                    }}
                                                                />
                                                                <div className="flex justify-end mt-3 gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 text-[11px] text-primary"
                                                                        onClick={() => handleNavigate(note)}
                                                                    >
                                                                        <ExternalLink className="w-3 h-3 mr-1" />
                                                                        Go to note
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 text-[11px] text-destructive hover:text-destructive"
                                                                        onClick={() => handleDelete(note.id)}
                                                                    >
                                                                        <Trash2 className="w-3 h-3 mr-1" />
                                                                        Delete
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
