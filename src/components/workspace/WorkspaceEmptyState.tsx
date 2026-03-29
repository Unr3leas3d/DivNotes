import React from 'react';
import { LoaderCircle } from 'lucide-react';

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
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#e7e2d8] bg-[#f8f6f1] px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#9aa294] shadow-[0_1px_2px_rgba(5,36,21,0.04)]">
        {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : icon}
      </div>
      <h3 className="text-[13px] font-medium text-[#173628]">{title}</h3>
      <p className="mt-2 max-w-[240px] text-[12px] leading-[1.5] text-[#8c978f]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
