import React from 'react';
import { SettingsView as WorkspaceSettingsView } from '@/popup/components/SettingsView';

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

export function SettingsView(props: SettingsViewProps) {
  return <WorkspaceSettingsView {...props} />;
}
