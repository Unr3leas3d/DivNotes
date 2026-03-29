import React, { useMemo, useRef, useState } from 'react';
import { PanelsTopLeft, Settings2 } from 'lucide-react';

import { WorkspaceActionDialog } from '@/components/workspace/WorkspaceActionDialog';
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
import {
    getInitialClearAllDialogState,
    prepareClearAllDialogForSubmit,
    resolveClearAllDialogError,
    validateNewFolderName,
} from './dialog-state';

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

const chromeWebStoreUrl = 'https://divnotes.com';
const privacyPolicyUrl = 'https://divnotes.com/privacy';
const newFolderLabel = 'New Folder';

type PopupDialogState =
    | { type: 'new-folder'; value: string; error: string | null }
    | { type: 'clear-all'; error: string | null }
    | null;

export function Dashboard({ email, onLogout, isLocalMode }: DashboardProps) {
    const workspace = useExtensionWorkspace({ shell: 'popup' });
    const previousViewRef = useRef<MainPopupView>('this-page');
    const [dialogState, setDialogState] = useState<PopupDialogState>(null);
    const [dialogSubmitting, setDialogSubmitting] = useState(false);
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

    const handleOpenSidePanel = async () => {
        try {
            await workspace.actions.openSidePanel();
            window.close();
        } catch {
            // The shared action already surfaced a user-visible error state.
        }
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

    const handleCreateFolder = () => {
        setDialogState({ type: 'new-folder', value: '', error: null });
    };

    const handleSubmitCreateFolder = async () => {
        if (!dialogState || dialogState.type !== 'new-folder') {
            return;
        }

        const validation = validateNewFolderName(dialogState.value);
        if (!validation.valid) {
            setDialogState((current) => (
                current?.type === 'new-folder'
                    ? { ...current, error: validation.error }
                    : current
            ));
            return;
        }

        setDialogSubmitting(true);
        try {
            const service = await getFoldersService();
            const siblings = workspace.data.folders.filter((folder) => folder.parentId === null);
            const folder: StoredFolder = {
                id: crypto.randomUUID(),
                name: validation.value,
                parentId: null,
                order: getNextOrder(siblings),
                color: null,
                pinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await service.create(folder);
            workspace.setView('folders');
            setDialogState(null);
        } catch (caughtError) {
            const message = caughtError instanceof Error ? caughtError.message : 'Failed to create folder';
            setDialogState((current) => (
                current?.type === 'new-folder'
                    ? { ...current, error: message }
                    : current
            ));
        } finally {
            setDialogSubmitting(false);
        }
    };

    const handleClearAllNotes = async () => {
        setDialogSubmitting(true);
        setDialogState((current) => (
            current?.type === 'clear-all'
                ? prepareClearAllDialogForSubmit(current)
                : current
        ));
        try {
            await workspace.actions.clearAllNotes();
            setDialogState(null);
        } catch (caughtError) {
            setDialogState((current) => (
                current?.type === 'clear-all'
                    ? { ...current, error: resolveClearAllDialogError(caughtError) }
                    : current
            ));
        } finally {
            setDialogSubmitting(false);
        }
    };

    const utilityAction = (() => {
        if (workspace.view.active === 'settings' || (workspace.view.active === 'folders' && workspace.view.folderId)) {
            return null;
        }

        return (
            <>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleOpenSidePanel()}
                    className="h-9 w-9 rounded-[12px] border border-[#e7e2d8] bg-white text-[#637267] hover:bg-[#f8f6f1]"
                    aria-label="Open side panel"
                >
                    <PanelsTopLeft className="h-4 w-4" />
                </Button>
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
            </>
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
                        onOpenSidePanel={() => void handleOpenSidePanel()}
                        onClearAll={() => setDialogState(getInitialClearAllDialogState())}
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
            errorMessage={dialogState?.type === 'clear-all' ? null : workspace.error.actions}
        >
            {content}
            <WorkspaceActionDialog
                open={dialogState?.type === 'new-folder'}
                onOpenChange={(open) => {
                    if (!open) {
                        setDialogState(null);
                    }
                }}
                title="Create Folder"
                description="Give this folder a clear name so notes stay easy to find."
                promptLabel={newFolderLabel}
                promptPlaceholder="Folder name"
                promptValue={dialogState?.type === 'new-folder' ? dialogState.value : ''}
                onPromptChange={(value) => {
                    setDialogState((current) => (
                        current?.type === 'new-folder'
                            ? { ...current, value, error: null }
                            : current
                    ));
                }}
                validationError={dialogState?.type === 'new-folder' ? dialogState.error : null}
                confirmLabel="Create Folder"
                onConfirm={() => void handleSubmitCreateFolder()}
                isSubmitting={dialogSubmitting}
            />
            <WorkspaceActionDialog
                open={dialogState?.type === 'clear-all'}
                onOpenChange={(open) => {
                    if (!open) {
                        setDialogState(null);
                    }
                }}
                title="Clear All Notes?"
                description="This removes every saved note in this profile. This cannot be undone."
                confirmLabel="Clear All"
                destructive
                inlineError={dialogState?.type === 'clear-all' ? dialogState.error : null}
                onConfirm={() => void handleClearAllNotes()}
                isSubmitting={dialogSubmitting}
            />
        </PopupShell>
    );
}
