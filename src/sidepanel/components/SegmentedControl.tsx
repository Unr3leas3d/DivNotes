import React from 'react';
import { FolderTree, Globe, MapPinned, Tags } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ViewMode = 'this-page' | 'all-notes' | 'folders' | 'tags';

interface SegmentedControlProps {
  value: ViewMode;
  counts?: Partial<Record<ViewMode, number>>;
  onChange: (mode: ViewMode) => void;
}

const items: { value: ViewMode; label: string; icon: React.ElementType }[] = [
  { value: 'this-page', label: 'This Page', icon: MapPinned },
  { value: 'all-notes', label: 'All Notes', icon: Globe },
  { value: 'folders', label: 'Folders', icon: FolderTree },
  { value: 'tags', label: 'Tags', icon: Tags },
];

export function SegmentedControl({ value, counts, onChange }: SegmentedControlProps) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[16px] bg-muted/50 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-[12px] px-2.5 py-2 text-[11px] font-medium transition-all',
            value === item.value
              ? 'bg-primary text-primary-foreground font-semibold shadow-card'
              : 'bg-muted text-foreground hover:bg-secondary'
          )}
        >
          <item.icon className="h-3.5 w-3.5" />
          <span>{item.label}</span>
          {typeof counts?.[item.value] === 'number' ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] leading-none',
                value === item.value ? 'bg-white/14 text-[#d8e3db]' : 'bg-white/70 text-[#7d897f]'
              )}
            >
              {counts[item.value]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
