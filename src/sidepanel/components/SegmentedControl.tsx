import React from 'react';
import { Globe, FolderTree, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'sites' | 'folders' | 'tags';

interface SegmentedControlProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const items: { value: ViewMode; label: string; icon: React.ElementType }[] = [
  { value: 'sites', label: 'Sites', icon: Globe },
  { value: 'folders', label: 'Folders', icon: FolderTree },
  { value: 'tags', label: 'Tags', icon: Tags },
];

export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  return (
    <div className="flex bg-muted/50 rounded-lg p-0.5">
      {items.map(item => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium rounded-md transition-all',
            value === item.value
              ? 'bg-primary/20 text-primary font-semibold'
              : 'text-muted-foreground/40 hover:text-muted-foreground/60'
          )}
        >
          <item.icon className="w-3.5 h-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
