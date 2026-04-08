import React from 'react';
import { ArrowLeft } from '@/lib/icon-aliases';

interface SidePanelShellProps {
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  statusBanner?: React.ReactNode;
  backLabel?: string;
  onBack?: () => void;
  errorMessage?: string | null;
  children: React.ReactNode;
}

export function SidePanelShell({
  navigation,
  actions,
  toolbar,
  statusBanner,
  backLabel,
  onBack,
  errorMessage,
  children,
}: SidePanelShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 pb-4 pt-5 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
              aria-label={backLabel || 'Back'}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[20px] tracking-[-0.35px] text-foreground">Canopy</p>
            <p className="text-[11px] text-muted-foreground">
              {backLabel ? backLabel : 'Think on top of the web.'}
            </p>
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
        {toolbar ? <div className="mt-4">{toolbar}</div> : null}
        {navigation ? <div className="mt-4">{navigation}</div> : null}
        {statusBanner ? <div className="mt-4">{statusBanner}</div> : null}
      </div>

      {errorMessage ? (
        <div className="mx-auto w-full max-w-[720px] px-5 pt-4">
          <div className="rounded-[14px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
            {errorMessage}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
