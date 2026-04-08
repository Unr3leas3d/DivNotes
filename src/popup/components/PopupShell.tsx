import React from 'react';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeIcon } from '@/components/ui/huge-icon';

interface PopupShellProps {
  navigation?: React.ReactNode;
  utilityAction?: React.ReactNode;
  backLabel?: string;
  onBack?: () => void;
  errorMessage?: string | null;
  children: React.ReactNode;
}

function CanopyMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-primary text-primary-foreground shadow-elevated">
      <svg width="22" height="22" viewBox="0 0 68 68" fill="none">
        <path d="M32 62 C33 52 33 44 33 36" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M33 36 C26 24 14 12 6 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M33 36 C42 22 54 10 62 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M33 36 C44 28 56 20 62 18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="6" cy="6" r="5" fill="var(--chart-1)" />
        <circle cx="62" cy="6" r="5" fill="var(--chart-1)" />
        <circle cx="62" cy="18" r="4.5" fill="var(--chart-1)" />
      </svg>
    </div>
  );
}

export function PopupShell({
  navigation,
  utilityAction,
  backLabel,
  onBack,
  errorMessage,
  children,
}: PopupShellProps) {
  return (
    <div className="flex h-full min-h-[500px] flex-col overflow-hidden bg-background text-foreground">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 pb-4 pt-5 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
              aria-label={backLabel || 'Back'}
            >
              <HugeIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
            </button>
          ) : null}
          <CanopyMark />
          <div className="min-w-0 flex-1 text-left">
            <p className="font-serif text-[19px] font-semibold tracking-[-0.35px] text-foreground">Canopy</p>
            <p className="text-[11px] font-semibold text-muted-foreground">
              {backLabel ? backLabel : 'Think on top of the web.'}
            </p>
          </div>
          {utilityAction ? <div className="shrink-0 flex items-center gap-2">{utilityAction}</div> : null}
        </div>
        {navigation ? <div className="mt-4">{navigation}</div> : null}
      </div>

      {errorMessage ? (
        <div className="mx-5 mt-4 rounded-[14px] border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </div>
  );
}
