import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WorkspaceActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  children?: React.ReactNode;
  cancelLabel?: string;
  destructive?: boolean;
  promptLabel?: string;
  promptPlaceholder?: string;
  promptValue?: string;
  validationError?: string | null;
  inlineError?: string | null;
  isSubmitting?: boolean;
  contentClassName?: string;
  onPromptChange?: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceActionDialog({
  open,
  title,
  description,
  confirmLabel,
  children,
  cancelLabel = 'Cancel',
  destructive = false,
  promptLabel,
  promptPlaceholder,
  promptValue,
  validationError,
  inlineError,
  isSubmitting = false,
  contentClassName,
  onPromptChange,
  onConfirm,
  onOpenChange,
}: WorkspaceActionDialogProps) {
  const [localValue, setLocalValue] = useState(promptValue ?? '');
  const value = promptValue ?? localValue;
  const inputId = React.useId();

  useEffect(() => {
    setLocalValue(promptValue ?? '');
  }, [promptValue, open]);

  const handleValueChange = (nextValue: string) => {
    if (onPromptChange) {
      onPromptChange(nextValue);
      return;
    }
    setLocalValue(nextValue);
  };

  const handleConfirm = () => {
    void onConfirm();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting && !nextOpen) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleConfirm();
  };
  const errorMessage = inlineError ?? validationError;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={contentClassName}
        showCloseButton
        closeButtonDisabled={isSubmitting}
        onEscapeKeyDown={(event) => {
          if (isSubmitting) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isSubmitting) {
            event.preventDefault();
          }
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {promptLabel ? (
            <div className="mt-4 space-y-1.5">
              <label
                htmlFor={inputId}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b968f]"
              >
                {promptLabel}
              </label>
              <Input
                id={inputId}
                value={value}
                onChange={(event) => handleValueChange(event.target.value)}
                placeholder={promptPlaceholder}
                className="h-10 rounded-[11px] border-[#e7e2d8] bg-white text-[13px] text-[#173628] placeholder:text-[#9aa294] focus-visible:ring-[#173628]/30"
                autoFocus
              />
            </div>
          ) : null}

          {children ? <div className="mt-4">{children}</div> : null}

          {errorMessage ? (
            <p className="mt-3 rounded-[10px] border border-[rgba(220,38,38,0.15)] bg-[rgba(254,242,242,0.75)] px-2.5 py-2 text-[11px] text-[#b91c1c]">
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-[11px] border-[#e7e2d8] bg-white text-[#445348] hover:bg-[#f8f6f1]"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={
                destructive
                  ? 'h-9 rounded-[11px] bg-[#b91c1c] text-white hover:bg-[#991b1b]'
                  : 'h-9 rounded-[11px] bg-[#173628] text-[#f5efe9] hover:bg-[#10271d]'
              }
            >
              {isSubmitting ? 'Working...' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
