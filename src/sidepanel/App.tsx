import React, { useState, useEffect, useRef } from 'react';
import { getNotesService, type NotesService } from '@/lib/notes-service';
import type { StoredNote, StoredFolder, StoredTag } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Search,
    Download,
} from 'lucide-react';
import { SegmentedControl, type ViewMode } from './components/SegmentedControl';
import { SitesView } from './components/SitesView';
import { FoldersView } from './components/FoldersView';
import { TagsView } from './components/TagsView';

export default function App() {
    const [viewMode, setViewMode] = useState<ViewMode>('sites');
    const [notes, setNotes] = useState<StoredNote[]>([]);
    const [folders, setFolders] = useState<StoredFolder[]>([]);
    const [tags, setTags] = useState<StoredTag[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [screenShareMode, setScreenShareMode] = useState(false);
    const serviceRef = useRef<NotesService | null>(null);

    // Init notes service
    useEffect(() => {
        getNotesService().then(s => { serviceRef.current = s; });
    }, []);

    // Load notes, folders, tags and screen share state from storage
    useEffect(() => {
        chrome.storage.local.get(['divnotes_notes', 'divnotes_folders', 'divnotes_tags', 'divnotes_screen_share'], (result) => {
            const allNotes: StoredNote[] = result.divnotes_notes || [];
            setNotes(allNotes);
            setFolders(result.divnotes_folders || []);
            setTags(result.divnotes_tags || []);
            setScreenShareMode(!!result.divnotes_screen_share);
        });

        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.divnotes_notes) {
                const updated: StoredNote[] = changes.divnotes_notes.newValue || [];
                setNotes(updated);
            }
            if (changes.divnotes_folders) {
                setFolders(changes.divnotes_folders.newValue || []);
            }
            if (changes.divnotes_tags) {
                setTags(changes.divnotes_tags.newValue || []);
            }
            if (changes.divnotes_screen_share) {
                setScreenShareMode(!!changes.divnotes_screen_share.newValue);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

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
        a.download = `canopy-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
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
                    <div className="flex-1">
                        <h1 className="font-['Georgia',serif] text-[15px] text-[#052415] tracking-[-0.3px]">Canopy</h1>
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

                {/* Segmented Control */}
                <div className="px-5 pb-3">
                    <SegmentedControl value={viewMode} onChange={setViewMode} />
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
                            data-search-input
                        />
                    </div>
                </div>
            </div>

            {/* View Content */}
            {viewMode === 'sites' && (
                <SitesView
                    notes={notes}
                    folders={folders}
                    tags={tags}
                    searchQuery={searchQuery}
                    onDeleteNote={handleDelete}
                    onNavigateNote={handleNavigate}
                />
            )}

            {viewMode === 'folders' && (
                <FoldersView
                    notes={notes}
                    folders={folders}
                    tags={tags}
                    searchQuery={searchQuery}
                    onDeleteNote={handleDelete}
                    onNavigateNote={handleNavigate}
                />
            )}

            {viewMode === 'tags' && (
                <TagsView
                    notes={notes}
                    folders={folders}
                    tags={tags}
                    searchQuery={searchQuery}
                    onDeleteNote={handleDelete}
                    onNavigateNote={handleNavigate}
                />
            )}
        </div>
    );
}
