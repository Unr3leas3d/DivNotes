import React from 'react';
import {
  CreditCardIcon,
  Database01Icon,
  HardDriveIcon,
  LinkSquare02Icon,
  UserCircle02Icon,
} from '@hugeicons/core-free-icons';
import { HugeIcon } from '@/components/ui/huge-icon';

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
  billingStatusLabel: 'Free' | 'Pro' | 'Inactive';
  billingStatusText: string;
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
  onUpgradeMonthly?: () => void | Promise<void>;
  onUpgradeYearly?: () => void | Promise<void>;
  onManageBilling?: () => void | Promise<void>;
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
    <section className="rounded-[18px] border border-border bg-card px-4 py-4 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
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
          ? 'flex h-[40px] w-full items-center justify-center rounded-[12px] border border-destructive/20 bg-destructive/5 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/10'
          : 'flex h-[40px] w-full items-center justify-center rounded-[12px] border border-border bg-secondary text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary/80'
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
  billingStatusLabel,
  billingStatusText,
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
  onUpgradeMonthly,
  onUpgradeYearly,
  onManageBilling,
  showSidePanelAction = true,
}: SettingsViewProps) {
  const showUpgradeActions = !isLocalMode && billingStatusLabel !== 'Pro';
  const showManageBillingAction = !isLocalMode && billingStatusLabel === 'Pro';

  return (
    <div className="space-y-4">
      <Section title={sectionTitles.account}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            {isLocalMode ? (
              <HugeIcon icon={HardDriveIcon} className="h-4 w-4" />
            ) : (
              <HugeIcon icon={UserCircle02Icon} className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {isLocalMode ? labels.localMode : email}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {isLocalMode ? 'Local' : billingStatusLabel}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {isLocalMode ? 'Saving only on this browser.' : billingStatusText}
              </p>
            </div>
          </div>
        </div>
        {!isLocalMode ? (
          <div className="rounded-[14px] border border-border bg-secondary px-3 py-3 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground">
              <HugeIcon icon={CreditCardIcon} className="h-3.5 w-3.5" />
              <span className="font-medium">
                {billingStatusLabel === 'Pro'
                  ? 'Cloud sync is unlocked on Pro.'
                  : 'Cloud sync requires Pro billing.'}
              </span>
            </div>
          </div>
        ) : null}
        {showUpgradeActions ? (
          <>
            <ActionButton label="Upgrade Monthly" onClick={onUpgradeMonthly || (() => {})} />
            <ActionButton label="Upgrade Yearly" onClick={onUpgradeYearly || (() => {})} />
          </>
        ) : null}
        {showManageBillingAction ? (
          <ActionButton label="Manage Billing" onClick={onManageBilling || (() => {})} />
        ) : null}
        <ActionButton label="Log Out" onClick={onLogout} destructive />
      </Section>

      <Section title={sectionTitles.data}>
        <div className="grid grid-cols-3 gap-2 text-center">
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
        <ActionButton label={labels.exportNotes} onClick={onExport} />
        <ActionButton label={labels.importNotes} onClick={onImport} />
        {showSidePanelAction ? (
          <ActionButton label={labels.openSidePanel} onClick={onOpenSidePanel || (() => {})} />
        ) : null}
        <ActionButton label={labels.clearAllNotes} onClick={onClearAll} destructive />
      </Section>

      <Section title={sectionTitles.about}>
        <div className="rounded-[14px] bg-secondary px-3 py-3 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <HugeIcon icon={Database01Icon} className="h-3.5 w-3.5" />
            <span>
              {labels.version}: <strong className="font-semibold text-foreground">{version}</strong>
            </span>
          </div>
        </div>

        <a
          href={chromeWebStoreUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-[14px] border border-border bg-secondary px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/80"
        >
          <span>{labels.chromeWebStore}</span>
          <HugeIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
        </a>

        <a
          href={privacyPolicyUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-[14px] border border-border bg-secondary px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/80"
        >
          <span>{labels.privacyPolicy}</span>
          <HugeIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
        </a>
      </Section>
    </div>
  );
}
