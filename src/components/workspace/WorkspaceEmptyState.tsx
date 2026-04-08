import React from 'react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeIcon } from '@/components/ui/huge-icon';

interface WorkspaceEmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
}

export function WorkspaceEmptyState({
  title,
  description,
  action,
  icon,
  loading = false,
}: WorkspaceEmptyStateProps) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[20px] border border-dashed border-border bg-muted px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-card">
        {loading ? <HugeIcon icon={Loading03Icon} className="h-5 w-5 animate-spin" /> : icon}
      </div>
      <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
      <p className="mt-2 max-w-[240px] text-[12px] leading-[1.5] text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
