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
    <div className="rounded-[14px] border border-[#e7e2d8] bg-[#f3f1eb] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="flex items-center gap-1">
        {items.map((item) => {
          const active = item.value === value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[11px] px-2.5 py-2 text-[11px] font-medium transition-colors',
                active
                  ? 'bg-[#173628] text-[#f5efe9] shadow-[0_6px_16px_rgba(5,36,21,0.16)]'
                  : 'text-[#637267] hover:bg-white/70'
              )}
            >
              <span className="truncate">{item.label}</span>
              {typeof item.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] leading-none',
                    active ? 'bg-white/14 text-[#d8e3db]' : 'bg-white/80 text-[#8b968e]'
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
