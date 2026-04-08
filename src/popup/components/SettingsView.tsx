import React from 'react';
import { LinkSquare02Icon, Database01Icon } from '@hugeicons/core-free-icons';
import { HugeIcon } from '@/components/ui/huge-icon';

interface SettingsViewProps {
  email: string;
  avatarUrl: string | null;
  fullName: string | null;
  isLocalMode: boolean;
  billingStatusLabel: 'Free' | 'Pro' | 'Inactive';
  cloudSyncEnabled: boolean;
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
  onUpgrade: () => void | Promise<void>;
  onContactSupport: () => void | Promise<void>;
}

function getInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0]) return parts[0][0].toUpperCase();
  }
  return email ? email[0].toUpperCase() : '?';
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
      onClick={() => { void onClick(); }}
      className={
        destructive
          ? 'flex h-[40px] w-full items-center justify-center rounded-[12px] border border-destructive/20 bg-destructive/5 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/10'
          : 'flex h-[40px] w-full items-center justify-center rounded-[12px] border border-border bg-secondary text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary/80'
      }
    >
      {label}
    </button>
  );
}

export function SettingsView({
  email,
  avatarUrl,
  fullName,
  isLocalMode,
  billingStatusLabel,
  cloudSyncEnabled,
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
  onUpgrade,
  onContactSupport,
}: SettingsViewProps) {
  const displayName = fullName || email || 'Local Mode';
  const planLabel = isLocalMode ? 'Local Mode' : billingStatusLabel === 'Pro' ? 'Pro Plan' : 'Free Plan';
  const isPro = billingStatusLabel === 'Pro';

  return (
    <section className="rounded-[18px] border border-border bg-card shadow-card">
      {/* Profile Header */}
      <div className="relative flex flex-col items-center px-5 pb-5 pt-7">
        {!isLocalMode && (
          <button
            type="button"
            onClick={() => { void onLogout(); }}
            className="absolute right-4 top-4 rounded-[10px] border border-border bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/80"
          >
            Log Out
          </button>
        )}

        {/* Avatar with sync dot */}
        <div className="relative mb-3.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-[72px] w-[72px] rounded-full border-[2.5px] border-border object-cover"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[2.5px] border-border bg-secondary text-[22px] font-bold text-muted-foreground">
              {getInitials(fullName, email)}
            </div>
          )}
          {!isLocalMode && (
            <span
              className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-card ${
                cloudSyncEnabled ? 'bg-emerald-400' : 'bg-muted-foreground/40'
              }`}
            />
          )}
        </div>

        <p className="text-[17px] font-bold text-foreground">{displayName}</p>
        <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">{planLabel}</p>
      </div>

      {/* Billing Message */}
      {!isLocalMode && (
        <div className="px-5 pb-5">
          <div className="rounded-[14px] border border-border bg-secondary/50 px-4 py-3.5 text-center">
            <p className="text-[12px] font-medium text-foreground">
              Signed in to the {isPro ? 'Pro' : 'Free'} plan
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isPro ? 'Cloud sync is active' : 'Cloud sync requires Pro billing'}
            </p>
            <button
              type="button"
              onClick={() => { void (isPro ? onContactSupport() : onUpgrade()); }}
              className="mt-3.5 flex h-[38px] w-full items-center justify-center rounded-[11px] bg-primary text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              {isPro ? 'Contact Support' : 'Purchase Pro Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-5 h-px bg-border" />

      {/* Data Section */}
      <div className="px-5 py-[18px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Data</p>
        <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[14px] bg-secondary px-2 py-3">
            <p className="text-[15px] font-semibold text-foreground">{noteCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Notes</p>
          </div>
          <div className="rounded-[14px] bg-secondary px-2 py-3">
            <p className="text-[15px] font-semibold text-foreground">{folderCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Folders</p>
          </div>
          <div className="rounded-[14px] bg-secondary px-2 py-3">
            <p className="text-[15px] font-semibold text-foreground">{tagCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Tags</p>
          </div>
        </div>
        <div className="mt-3.5 space-y-2">
          <ActionButton label="Export Notes" onClick={onExport} />
          <ActionButton label="Import Notes" onClick={onImport} />
          <ActionButton label="Clear All Notes" onClick={onClearAll} destructive />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-border" />

      {/* About Section */}
      <div className="px-5 py-[18px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">About</p>
        <div className="mt-3.5 space-y-2">
          <div className="flex items-center gap-2 rounded-[14px] bg-secondary px-3 py-3 text-[12px] text-muted-foreground">
            <HugeIcon icon={Database01Icon} className="h-3.5 w-3.5" />
            <span>
              Version: <strong className="font-semibold text-foreground">{version}</strong>
            </span>
          </div>
          <a
            href={chromeWebStoreUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-[14px] border border-border bg-secondary px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/80"
          >
            <span>Chrome Web Store</span>
            <HugeIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
          </a>
          <a
            href={privacyPolicyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-[14px] border border-border bg-secondary px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/80"
          >
            <span>Privacy Policy</span>
            <HugeIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
