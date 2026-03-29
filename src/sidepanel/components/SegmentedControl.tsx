import React from 'react';

import { TopNavPills } from '@/components/workspace/TopNavPills';

export type ViewMode = 'this-page' | 'all-notes' | 'folders' | 'tags';

interface SegmentedControlProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const items: Array<{ value: ViewMode; label: string }> = [
  { value: 'this-page', label: 'This Page' },
  { value: 'all-notes', label: 'All Notes' },
  { value: 'folders', label: 'Folders' },
  { value: 'tags', label: 'Tags' },
];

export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  return (
    <TopNavPills
      items={items}
      value={value}
      onChange={(nextValue) => onChange(nextValue as ViewMode)}
    />
  );
}
