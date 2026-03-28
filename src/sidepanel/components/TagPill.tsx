import { cn } from '@/lib/utils';
import { Tag, X } from 'lucide-react';
import type { StoredTag } from '@/lib/types';

interface TagPillProps {
  tag: StoredTag;
  onClick?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  active?: boolean;
}

export function TagPill({ tag, onClick, onRemove, size = 'sm', active }: TagPillProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium cursor-pointer transition-all',
        size === 'sm' ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2.5 py-1',
        active && 'ring-1',
      )}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        borderColor: active ? `${tag.color}60` : undefined,
      }}
    >
      {size === 'md' && <Tag className="w-2.5 h-2.5" />}
      {tag.name}
      {onRemove && (
        <X
          className="w-2.5 h-2.5 opacity-60 hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        />
      )}
    </span>
  );
}
