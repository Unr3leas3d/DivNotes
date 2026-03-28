import React, { useState, useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { assignRandomColor } from '@/lib/tag-utils';
import type { StoredTag } from '@/lib/types';
import { Tag, Plus, Check } from 'lucide-react';
import { TagPill } from './TagPill';

interface TagPickerProps {
  tags: StoredTag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string) => void;
  trigger: React.ReactNode;
}

export function TagPicker({
  tags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
  trigger,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTags = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(query));
  }, [tags, search]);

  const exactMatch = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return tags.some((t) => t.name.toLowerCase() === query);
  }, [tags, search]);

  const handleCreate = () => {
    const name = search.trim();
    if (name && !exactMatch) {
      onCreateTag(name);
      setSearch('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !exactMatch && search.trim()) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        {/* Search input */}
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or create tag..."
          className="h-7 text-xs mb-2"
        />

        {/* Tag list */}
        <div className="max-h-[200px] overflow-y-auto space-y-0.5">
          {filteredTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => onToggleTag(tag.id)}
                className="flex items-center gap-2 w-full px-1.5 py-1 text-xs rounded-md hover:bg-accent transition-colors"
              >
                <TagPill tag={tag} size="sm" active={isSelected} />
                <span className="flex-1" />
                {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}

          {/* Create new tag option */}
          {!exactMatch && search.trim() && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 w-full px-1.5 py-1 text-xs rounded-md hover:bg-accent transition-colors text-muted-foreground"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create &ldquo;{search.trim()}&rdquo;</span>
            </button>
          )}

          {/* Empty state */}
          {filteredTags.length === 0 && !search.trim() && (
            <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground">
              <Tag className="w-3.5 h-3.5" />
              <span>No tags yet</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
