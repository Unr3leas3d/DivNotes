import React from 'react';
import { Hash } from 'lucide-react';

import type { TagSummary } from '@/lib/extension-selectors';
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
        'rounded-[20px] border border-[#ece7de] bg-white shadow-[0_1px_2px_rgba(5,36,21,0.04)]',
        density === 'compact' ? 'px-3 py-3' : 'px-4 py-4'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa294]">Tags</p>
          <p className="mt-1 text-[13px] font-semibold text-[#173628]">
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
              ? 'border-[#e7e2d8] bg-[#f8f6f1] text-[#526357] hover:bg-[#f1eee7]'
              : 'cursor-not-allowed border-[#eee8de] bg-[#faf8f4] text-[#b0b8b0]'
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
                  ? 'border-[#173628] bg-[#173628] text-[#f5efe9]'
                  : 'border-[#e7e2d8] bg-[#f8f6f1] text-[#637267] hover:bg-[#f1eee7]'
              )}
            >
              <Hash className="h-3 w-3" />
              <span className="truncate">{summary.tag.name}</span>
              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] leading-none">
                {summary.count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-[1.5] text-[#8c978f]">
        {hasActiveFilters
          ? `Filtering by ${selectedCount} ${selectedCount === 1 ? 'tag' : 'tags'}.`
          : 'Select one or more tags to see matching notes.'}
      </p>
    </div>
  );
}
