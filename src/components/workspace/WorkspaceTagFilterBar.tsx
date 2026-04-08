import React from 'react';
import { HashtagIcon } from '@hugeicons/core-free-icons';

import type { TagSummary } from '@/lib/extension-selectors';
import { HugeIcon } from '@/components/ui/huge-icon';
import { cn } from '@/lib/utils';

interface WorkspaceTagFilterBarProps {
  tagSummaries: TagSummary[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClearFilters: () => void;
  density?: 'comfortable' | 'compact';
}

export function WorkspaceTagFilterBar({
  tagSummaries,
  selectedTagIds,
  onToggleTag,
  onClearFilters,
  density = 'comfortable',
}: WorkspaceTagFilterBarProps) {
  const hasActiveFilters = selectedTagIds.length > 0;
  const selectedCount = selectedTagIds.length;

  return (
    <div
      className={cn(
        'rounded-[20px] border border-border bg-card shadow-card',
        density === 'compact' ? 'px-3 py-3' : 'px-4 py-4'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tags</p>
          <p className="mt-1 text-[13px] font-semibold text-foreground">
            {tagSummaries.length} {tagSummaries.length === 1 ? 'tag' : 'tags'} available
          </p>
        </div>

        <button
          type="button"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          className={cn(
            'rounded-[12px] border px-3 py-1.5 text-[11px] font-medium transition-colors',
            hasActiveFilters
              ? 'border-border bg-secondary text-muted-foreground hover:bg-secondary/80'
              : 'cursor-not-allowed border-border bg-muted/60 text-muted-foreground/60'
          )}
        >
          Clear filters
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tagSummaries.map((summary) => {
          const active = selectedTagIds.includes(summary.tag.id);

          return (
            <button
              key={summary.tag.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleTag(summary.tag.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-secondary text-muted-foreground hover:bg-secondary/80'
              )}
            >
              <HugeIcon icon={HashtagIcon} className="h-3 w-3" />
              <span className="truncate">{summary.tag.name}</span>
              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] leading-none">
                {summary.count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-[1.5] text-muted-foreground">
        {hasActiveFilters
          ? `Filtering by ${selectedCount} ${selectedCount === 1 ? 'tag' : 'tags'}.`
          : 'Select one or more tags to see matching notes.'}
      </p>
    </div>
  );
}
