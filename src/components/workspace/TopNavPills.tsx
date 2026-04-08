import React from 'react';

import { cn } from '@/lib/utils';

interface TopNavPillItem {
  value: string;
  label: string;
  count?: number;
}

interface TopNavPillsProps {
  items: TopNavPillItem[];
  value: string;
  onChange: (value: string) => void;
}

export function TopNavPills({ items, value, onChange }: TopNavPillsProps) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-1">
      <div className="flex items-center gap-1">
        {items.map((item) => {
          const active = item.value === value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/70'
              )}
            >
              <span className="truncate">{item.label}</span>
              {typeof item.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] leading-none',
                    active ? 'bg-white/14 text-primary-foreground/70' : 'bg-card/80 text-muted-foreground'
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
