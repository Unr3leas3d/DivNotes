import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    StickyNote,
    MousePointerClick,
    PanelRightOpen,
    LogOut,
    ExternalLink,
    FileText,
    Globe,
    Keyboard,
    Download,
    Upload,
    HardDrive,
    Trash2,
} from 'lucide-react';

interface DashboardProps {
    email: string;
    onLogout: () => void;
    isLocalMode: boolean;
}

interface StoredNote {
    id: string;
    url: string;
    hostname: string;
    pageTitle: string;
    elementSelector: string;
    elementTag: string;
    content: string;
    createdAt: string;
}

export function Dashboard({ email, onLogout, isLocalMode }: DashboardProps) {
    const [notes, setNotes] = useState<StoredNote[]>([]);
    const [noteCount, setNoteCount] = useState(0);
    const [importing, setImporting] = useState(false);

    // Load notes from storage
    useEffect(() => {
        chrome.storage.local.get(['divnotes_notes'], (result) => {
            const allNotes: StoredNote[] = result.divnotes_notes || [];
            setNotes(allNotes);
            setNoteCount(allNotes.length);
        });

        // Listen for note changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.divnotes_notes) {
                const updated: StoredNote[] = changes.divnotes_notes.newValue || [];
                setNotes(updated);
                setNoteCount(updated.length);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    const handleSelectElement = () => {
        chrome.runtime.sendMessage({ type: 'ACTIVATE_INSPECTOR' }, () => {
            setTimeout(() => window.close(), 100);
        });
    };

    const handleOpenSidePanel = () => {
        chrome.windows.getCurrent((win) => {
            if (win.id) {
                chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL', windowId: win.id });
                window.close();
            }
        });
    };

    const handleToggleNotes = () => {
        chrome.runtime.sendMessage({ type: 'TOGGLE_NOTES' }, () => {
            setTimeout(() => window.close(), 100);
        });
    };

    const handleExport = () => {
        chrome.storage.local.get(['divnotes_notes'], (result) => {
            const data = {
                version: 1,
                exportedAt: new Date().toISOString(),
                notes: result.divnotes_notes || [],
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `canopy-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            setImporting(true);
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target?.result as string);
                    if (data.notes && Array.isArray(data.notes)) {
                        // Merge with existing notes (deduplicate by id)
                        chrome.storage.local.get(['divnotes_notes'], (result) => {
                            const existing: StoredNote[] = result.divnotes_notes || [];
                            const existingIds = new Set(existing.map((n: StoredNote) => n.id));
                            const newNotes = data.notes.filter((n: StoredNote) => !existingIds.has(n.id));
                            const merged = [...existing, ...newNotes];
                            chrome.storage.local.set({ divnotes_notes: merged }, () => {
                                setImporting(false);
                            });
                        });
                    } else {
                        console.error('[Canopy] Invalid import file format');
                        setImporting(false);
                    }
                } catch (err) {
                    console.error('[Canopy] Import error:', err);
                    setImporting(false);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // Get current tab's notes
    const recentNotes = notes.slice(-5).reverse();

    const handlePurge = () => {
        if (confirm('Delete ALL notes? This cannot be undone.')) {
            chrome.storage.local.set({ divnotes_notes: [] });
        }
    };

    return (
        <div className="flex flex-col min-h-[500px]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#052415] flex items-center justify-center flex-shrink-0">
                        <svg width="18" height="18" viewBox="0 0 68 68" fill="none">
                            <path d="M32 62 C33 52 33 44 33 36" stroke="#F5EFE9" strokeWidth="4.5" strokeLinecap="round"/>
                            <path d="M33 36 C26 24 14 12 6 6" stroke="#F5EFE9" strokeWidth="4" strokeLinecap="round"/>
                            <path d="M33 36 C42 22 54 10 62 6" stroke="#F5EFE9" strokeWidth="4" strokeLinecap="round"/>
                            <path d="M33 36 C44 28 56 20 62 18" stroke="#F5EFE9" strokeWidth="3.5" strokeLinecap="round"/>
                            <circle cx="6" cy="6" r="5" fill="#ABFFC0"/>
                            <circle cx="62" cy="6" r="5" fill="#ABFFC0"/>
                            <circle cx="62" cy="18" r="4.5" fill="#ABFFC0"/>
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-['Georgia',serif] text-[15px] text-[#052415] tracking-[-0.3px]">Canopy</h1>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px] flex items-center gap-1">
                            {isLocalMode && <HardDrive className="w-3 h-3" />}
                            {email}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onLogout}
                >
                    <LogOut className="w-4 h-4" />
                </Button>
            </div>

            <Separator className="opacity-50" />

            {/* Actions */}
            <div className="px-5 py-4 space-y-2">
                <Button
                    className="w-full justify-start gap-3 h-11 text-sm"
                    onClick={handleSelectElement}
                >
                    <MousePointerClick className="w-4 h-4" />
                    Select Element
                    <span className="ml-auto text-[10px] opacity-50 font-mono">⌘⇧S</span>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="secondary"
                        className="justify-start gap-1.5 h-10 text-xs"
                        onClick={handleToggleNotes}
                    >
                        <Keyboard className="w-3.5 h-3.5" />
                        Toggle
                        <span className="ml-auto text-[10px] opacity-50 font-mono">⌘⇧N</span>
                    </Button>
                    <Button
                        variant="secondary"
                        className="justify-start gap-2 h-10 text-xs"
                        onClick={handleOpenSidePanel}
                    >
                        <PanelRightOpen className="w-3.5 h-3.5" />
                        Side Panel
                    </Button>
                </div>
            </div>

            <Separator className="opacity-50" />

            {/* Notes Count + Import/Export */}
            <div className="px-5 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">All notes</span>
                    </div>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                        {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                    </span>
                </div>

                {/* Import/Export buttons */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-border/40"
                        onClick={handleExport}
                        disabled={noteCount === 0}
                    >
                        <Download className="w-3 h-3" />
                        Export
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-border/40"
                        onClick={handleImport}
                        disabled={importing}
                    >
                        <Upload className="w-3 h-3" />
                        {importing ? 'Importing...' : 'Import'}
                    </Button>
                </div>

                {/* Clear All */}
                {noteCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-[11px] text-destructive/70 hover:text-destructive mt-1"
                        onClick={handlePurge}
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear All Notes
                    </Button>
                )}
            </div>

            <Separator className="opacity-50" />

            {/* Recent Notes */}
            <div className="flex-1 px-5 py-3 overflow-y-auto">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Recent Notes
                </p>
                {recentNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <StickyNote className="w-8 h-8 text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground/60">No notes yet</p>
                        <p className="text-[10px] text-muted-foreground/40 mt-1">
                            Click "Select Element" to start annotating
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {recentNotes.map((note) => (
                            <Card
                                key={note.id}
                                className="border-border/40 bg-card/30 hover:bg-card/60 transition-colors cursor-pointer group"
                                onClick={() => {
                                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                        const currentTab = tabs[0];
                                        if (currentTab?.url === note.url && currentTab?.id) {
                                            chrome.tabs.sendMessage(currentTab.id, {
                                                type: 'SCROLL_TO_NOTE',
                                                selector: note.elementSelector,
                                            });
                                        } else if (currentTab?.id) {
                                            chrome.tabs.update(currentTab.id, { url: note.url });
                                        }
                                    });
                                }}
                            >
                                <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                    &lt;{note.elementTag}&gt;
                                                </span>
                                                <span className="text-[10px] text-muted-foreground truncate">
                                                    {note.hostname}
                                                </span>
                                            </div>
                                            <p className="text-xs text-foreground/90 line-clamp-2">
                                                {note.content}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <FileText className="w-3 h-3 text-muted-foreground/60" />
                                                <span className="text-[10px] text-muted-foreground/60 truncate">
                                                    {note.pageTitle || note.hostname}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/40 ml-auto">
                                                    {new Date(note.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
