import React, { useMemo, useRef } from 'react';
import { Settings2 } from 'lucide-react';

import { TopNavPills } from '@/components/workspace/TopNavPills';
import { Button } from '@/components/ui/button';
import { getFoldersService } from '@/lib/folders-service';
import { getNextOrder } from '@/lib/tag-utils';
import { useExtensionWorkspace, type WorkspaceView } from '@/lib/use-extension-workspace';
import type { StoredFolder, StoredNote, StoredTag } from '@/lib/types';
import { PopupShell } from './components/PopupShell';
import { ThisPageView } from './components/ThisPageView';
import { AllNotesView } from './components/AllNotesView';
import { FoldersView } from './components/FoldersView';
import { TagsView } from './components/TagsView';
import { SettingsView } from './components/SettingsView';

interface DashboardProps {
    email: string;
    onLogout: () => void;
    isLocalMode: boolean;
}

type MainPopupView = Exclude<WorkspaceView, 'settings'>;

const navItems: Array<{ value: MainPopupView; label: string }> = [
    { value: 'this-page', label: 'This Page' },
    { value: 'all-notes', label: 'All Notes' },
    { value: 'folders', label: 'Folders' },
    { value: 'tags', label: 'Tags' },
];

const settingsSectionTitles = {
    account: 'Account',
    data: 'Data',
    about: 'About',
    root: 'Settings',
};

const settingsLabels = {
    localMode: 'Local Mode',
    exportNotes: 'Export Notes',
    importNotes: 'Import Notes',
    clearAllNotes: 'Clear All Notes',
    openSidePanel: 'Open Side Panel',
    version: 'Version',
    chromeWebStore: 'Chrome Web Store',
    privacyPolicy: 'Privacy Policy',
};

const chromeWebStoreUrl = 'https://chromewebstore.google.com/';
const privacyPolicyUrl = 'https://www.notion.so/';
const newFolderLabel = 'New Folder';

export function Dashboard({ email, onLogout, isLocalMode }: DashboardProps) {
    const workspace = useExtensionWorkspace({ shell: 'popup' });
    const previousViewRef = useRef<MainPopupView>('this-page');
    const notesById = useMemo(() => new Map(workspace.data.notes.map((note) => [note.id, note])), [workspace.data.notes]);
    const foldersById = useMemo(
        () => new Map(workspace.data.folders.map((folder) => [folder.id, folder])),
        [workspace.data.folders]
    );
    const tagsById = useMemo(() => new Map(workspace.data.tags.map((tag) => [tag.id, tag])), [workspace.data.tags]);

    const loadingContent = workspace.loading.currentPage || workspace.loading.data;
    const activeMainView = workspace.view.active === 'settings'
        ? previousViewRef.current
        : (workspace.view.active as MainPopupView);

    const handleMainViewChange = (nextView: string) => {
        previousViewRef.current = nextView as MainPopupView;
        workspace.actions.clearFilters();
        workspace.setView(nextView as MainPopupView);
    };

    const handleOpenSettings = () => {
        previousViewRef.current = activeMainView;
        workspace.setView('settings');
    };

    const handleBack = () => {
        if (workspace.view.active === 'settings') {
            workspace.setView(previousViewRef.current);
            return;
        }

        if (workspace.view.active === 'folders' && workspace.view.folderId) {
            workspace.actions.setFolderDetail(null);
        }
    };

    const handleAddNote = async () => {
        await workspace.actions.activateInspector();
        window.close();
    };

    const handleOpenNote = (note: StoredNote) => {
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
            window.close();
        });
    };

    const handleCreateFolder = async () => {
        const name = window.prompt(`${newFolderLabel} name:`);
        if (!name || !name.trim()) {
            return;
        }

        const service = await getFoldersService();
        const siblings = workspace.data.folders.filter((folder) => folder.parentId === null);
        const folder: StoredFolder = {
            id: crypto.randomUUID(),
            name: name.trim(),
            parentId: null,
            order: getNextOrder(siblings),
            color: null,
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await service.create(folder);
        workspace.setView('folders');
    };

    const utilityAction = (() => {
        if (workspace.view.active === 'settings' || (workspace.view.active === 'folders' && workspace.view.folderId)) {
            return null;
        }

        return (
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleOpenSettings}
                className="h-9 w-9 rounded-[12px] border border-[#e7e2d8] bg-white text-[#637267] hover:bg-[#f8f6f1]"
                aria-label="Open settings"
            >
                <Settings2 className="h-4 w-4" />
            </Button>
        );
    })();

    const backLabel = workspace.view.active === 'settings'
        ? settingsSectionTitles.root
        : workspace.view.active === 'folders' && workspace.view.folderId
            ? 'Folders'
            : undefined;

    const navigation = workspace.view.active === 'settings' || (workspace.view.active === 'folders' && workspace.view.folderId)
        ? undefined
        : (
            <TopNavPills
                items={navItems}
                value={activeMainView}
                onChange={handleMainViewChange}
            />
        );

    const content = (() => {
        switch (workspace.view.active) {
            case 'this-page':
                return (
                    <ThisPageView
                        currentPage={workspace.currentPage}
                        notes={workspace.derived.thisPageNotes}
                        loading={loadingContent}
                        error={workspace.error.currentPage || workspace.error.data}
                        tagsById={tagsById}
                        onAddNote={() => void handleAddNote()}
                        onOpenNote={handleOpenNote}
                    />
                );
            case 'all-notes':
                return (
                    <AllNotesView
                        groupedNotes={workspace.derived.groupedNotes}
                        notes={workspace.data.notes}
                        foldersById={foldersById}
                        tagsById={tagsById}
                        loading={loadingContent}
                        error={workspace.error.data}
                        onOpenNote={handleOpenNote}
                    />
                );
            case 'folders':
                return (
                    <FoldersView
                        folderSummaries={workspace.derived.folderSummaries}
                        foldersById={foldersById}
                        notesById={notesById}
                        tagsById={tagsById}
                        selectedFolderId={workspace.view.folderId}
                        loading={workspace.loading.data}
                        error={workspace.error.data}
                        onSelectFolder={workspace.actions.setFolderDetail}
                        onCreateFolder={() => void handleCreateFolder()}
                        onOpenNote={handleOpenNote}
                    />
                );
            case 'tags':
                return (
                    <TagsView
                        tagSummaries={workspace.derived.tagSummaries}
                        selectedTagId={workspace.view.tagId}
                        notes={workspace.data.notes}
                        foldersById={foldersById}
                        tagsById={tagsById}
                        loading={workspace.loading.data}
                        error={workspace.error.data}
                        onSelectTag={workspace.actions.setTagFilter}
                        onOpenNote={handleOpenNote}
                    />
                );
            case 'settings':
                return (
                    <SettingsView
                        sectionTitles={settingsSectionTitles}
                        labels={settingsLabels}
                        email={email}
                        isLocalMode={isLocalMode}
                        version={chrome.runtime.getManifest().version}
                        noteCount={workspace.data.notes.length}
                        folderCount={workspace.data.folders.length}
                        tagCount={workspace.data.tags.length}
                        chromeWebStoreUrl={chromeWebStoreUrl}
                        privacyPolicyUrl={privacyPolicyUrl}
                        onLogout={onLogout}
                        onExport={workspace.actions.exportNotes}
                        onImport={workspace.actions.importNotes}
                        onOpenSidePanel={workspace.actions.openSidePanel}
                        onClearAll={async () => {
                            const confirmed = window.confirm('Delete ALL notes? This cannot be undone.');
                            if (confirmed) {
                                await workspace.actions.clearAllNotes();
                            }
                        }}
                    />
                );
            default:
                return null;
        }
    })();

    return (
        <PopupShell
            navigation={navigation}
            utilityAction={utilityAction}
            backLabel={backLabel}
            onBack={backLabel ? handleBack : undefined}
            errorMessage={workspace.error.actions}
        >
            {content}
        </PopupShell>
    );
}
