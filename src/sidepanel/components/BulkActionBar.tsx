import React from 'react';
import { Folder, Tag, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BulkActionBarProps {
  count: number;
  onMoveToFolder: () => void;
  onAddTags: () => void;
  onPin: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, onMoveToFolder, onAddTags, onPin, onDelete, onClear }: BulkActionBarProps) {
  if (count < 2) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-2 flex items-center gap-2 z-50">
      <span className="text-xs font-medium text-muted-foreground ml-2">
        {count} selected
      </span>
      <div className="flex-1 flex items-center gap-1 justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onMoveToFolder}>
          <Folder className="w-3 h-3 mr-1" /> Move
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAddTags}>
          <Tag className="w-3 h-3 mr-1" /> Tag
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onPin}>
          <Star className="w-3 h-3 mr-1" /> Pin
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={onDelete}>
          <Trash2 className="w-3 h-3 mr-1" /> Delete
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
