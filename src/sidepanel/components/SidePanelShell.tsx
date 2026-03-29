import React from 'react';
import { ArrowLeft } from 'lucide-react';

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

function CanopyMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#0b2417] shadow-[0_12px_24px_rgba(5,36,21,0.12)]">
      <svg width="24" height="24" viewBox="0 0 68 68" fill="none">
        <path d="M32 62 C33 52 33 44 33 36" stroke="#F5EFE9" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M33 36 C26 24 14 12 6 6" stroke="#F5EFE9" strokeWidth="4" strokeLinecap="round" />
        <path d="M33 36 C42 22 54 10 62 6" stroke="#F5EFE9" strokeWidth="4" strokeLinecap="round" />
        <path d="M33 36 C44 28 56 20 62 18" stroke="#F5EFE9" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="6" cy="6" r="5" fill="#ABFFC0" />
        <circle cx="62" cy="6" r="5" fill="#ABFFC0" />
        <circle cx="62" cy="18" r="4.5" fill="#ABFFC0" />
      </svg>
    </div>
  );
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
    <div className="flex min-h-screen flex-col bg-[#fcfbf7] text-[#173628]">
      <div className="sticky top-0 z-20 border-b border-[#ece7de] bg-[#fcfbf7]/95 px-5 pb-4 pt-5 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#e7e2d8] bg-white text-[#5d6d62] transition-colors hover:bg-[#f8f6f1]"
              aria-label={backLabel || 'Back'}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : null}
          <CanopyMark />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[20px] tracking-[-0.35px] text-[#173628]">Canopy</p>
            <p className="text-[11px] text-[#8f998f]">
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
        <div className="mx-5 mt-4 rounded-[14px] border border-[rgba(220,38,38,0.15)] bg-[rgba(254,242,242,0.9)] px-3 py-2 text-[11px] text-[#b91c1c]">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </div>
  );
}
