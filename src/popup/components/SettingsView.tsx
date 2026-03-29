import React from 'react';
import { Database, ExternalLink, HardDrive, LogOut, UserRound } from 'lucide-react';

interface SettingsViewProps {
  sectionTitles: {
    account: string;
    data: string;
    about: string;
  };
  labels: {
    localMode: string;
    exportNotes: string;
    importNotes: string;
    clearAllNotes: string;
    openSidePanel: string;
    version: string;
    chromeWebStore: string;
    privacyPolicy: string;
  };
  email: string;
  isLocalMode: boolean;
  version: string;
  noteCount: number;
  folderCount: number;
  tagCount: number;
  chromeWebStoreUrl: string;
  privacyPolicyUrl: string;
  onLogout: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onImport: () => void | Promise<void>;
  onClearAll: () => void | Promise<void>;
  onOpenSidePanel?: () => void | Promise<void>;
  showSidePanelAction?: boolean;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[#ece7de] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(5,36,21,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa294]">{title}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function ActionButton({
  label,
  onClick,
  destructive = false,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      className={
        destructive
          ? 'flex h-[40px] w-full items-center justify-center rounded-[12px] border border-[rgba(220,38,38,0.14)] bg-[rgba(254,242,242,0.7)] text-[12px] font-semibold text-[#b91c1c] transition-colors hover:bg-[rgba(254,226,226,0.92)]'
          : 'flex h-[40px] w-full items-center justify-center rounded-[12px] border border-[#e7e2d8] bg-[#f8f6f1] text-[12px] font-semibold text-[#314339] transition-colors hover:bg-[#f1eee7]'
      }
    >
      {label}
    </button>
  );
}

export function SettingsView({
  sectionTitles,
  labels,
  email,
  isLocalMode,
  version,
  noteCount,
  folderCount,
  tagCount,
  chromeWebStoreUrl,
  privacyPolicyUrl,
  onLogout,
  onExport,
  onImport,
  onClearAll,
  onOpenSidePanel,
  showSidePanelAction = true,
}: SettingsViewProps) {
  return (
    <div className="space-y-4">
      <Section title={sectionTitles.account}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f1eb] text-[#657368]">
            {isLocalMode ? <HardDrive className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#173628]">
              {isLocalMode ? labels.localMode : email}
            </p>
            <p className="text-[11px] text-[#8c978f]">
              {isLocalMode ? 'Saving only on this browser.' : 'Signed in and syncing when available.'}
            </p>
          </div>
        </div>
        <ActionButton label="Log Out" onClick={onLogout} destructive />
      </Section>

      <Section title={sectionTitles.data}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[14px] bg-[#f8f6f1] px-2 py-3">
            <p className="text-[15px] font-semibold text-[#173628]">{noteCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#96a095]">Notes</p>
          </div>
          <div className="rounded-[14px] bg-[#f8f6f1] px-2 py-3">
            <p className="text-[15px] font-semibold text-[#173628]">{folderCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#96a095]">Folders</p>
          </div>
          <div className="rounded-[14px] bg-[#f8f6f1] px-2 py-3">
            <p className="text-[15px] font-semibold text-[#173628]">{tagCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#96a095]">Tags</p>
          </div>
        </div>
        <ActionButton label={labels.exportNotes} onClick={onExport} />
        <ActionButton label={labels.importNotes} onClick={onImport} />
        {showSidePanelAction ? (
          <ActionButton label={labels.openSidePanel} onClick={onOpenSidePanel || (() => {})} />
        ) : null}
        <ActionButton label={labels.clearAllNotes} onClick={onClearAll} destructive />
      </Section>

      <Section title={sectionTitles.about}>
        <div className="rounded-[14px] bg-[#f8f6f1] px-3 py-3 text-[12px] text-[#5b6a5f]">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5" />
            <span>
              {labels.version}: <strong className="font-semibold text-[#173628]">{version}</strong>
            </span>
          </div>
        </div>

        <a
          href={chromeWebStoreUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-[14px] border border-[#e7e2d8] bg-[#f8f6f1] px-3 py-3 text-[12px] font-medium text-[#314339] transition-colors hover:bg-[#f1eee7]"
        >
          <span>{labels.chromeWebStore}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <a
          href={privacyPolicyUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-[14px] border border-[#e7e2d8] bg-[#f8f6f1] px-3 py-3 text-[12px] font-medium text-[#314339] transition-colors hover:bg-[#f1eee7]"
        >
          <span>{labels.privacyPolicy}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Section>
    </div>
  );
}
