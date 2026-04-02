import React from 'react';

import { SettingsView as WorkspaceSettingsView } from '@/popup/components/SettingsView';

interface SettingsViewProps {
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
  onUpgradeMonthly: () => void | Promise<void>;
  onUpgradeYearly: () => void | Promise<void>;
  onManageBilling: () => void | Promise<void>;
}

const sectionTitles = {
  account: 'Account',
  data: 'Data',
  about: 'About',
};

const labels = {
  localMode: 'Local Mode',
  exportNotes: 'Export Notes',
  importNotes: 'Import Notes',
  clearAllNotes: 'Clear All Notes',
  openSidePanel: 'Open Side Panel',
  version: 'Version',
  chromeWebStore: 'Chrome Web Store',
  privacyPolicy: 'Privacy Policy',
};

export function SettingsView(props: SettingsViewProps) {
  return (
    <WorkspaceSettingsView
      sectionTitles={sectionTitles}
      labels={labels}
      email={props.email}
      isLocalMode={props.isLocalMode}
      billingStatusLabel={props.billingStatusLabel}
      billingStatusText={props.billingStatusText}
      version={props.version}
      noteCount={props.noteCount}
      folderCount={props.folderCount}
      tagCount={props.tagCount}
      chromeWebStoreUrl={props.chromeWebStoreUrl}
      privacyPolicyUrl={props.privacyPolicyUrl}
      onLogout={props.onLogout}
      onExport={props.onExport}
      onImport={props.onImport}
      onClearAll={props.onClearAll}
      onUpgradeMonthly={props.onUpgradeMonthly}
      onUpgradeYearly={props.onUpgradeYearly}
      onManageBilling={props.onManageBilling}
      showSidePanelAction={false}
    />
  );
}
